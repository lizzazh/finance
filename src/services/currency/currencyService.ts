import { db } from '../../db/database';
import type { CurrencyCode, ExchangeRate } from '../../types';
import type { CurrencyProvider } from './currencyProvider';
import { nbuProvider } from './providers/nbuProvider';
import { manualProvider } from './providers/manualProvider';
import { generateId } from '../../utils/id';
import { today } from '../../utils/date';

// Static fallback rates (UAH per 1 unit of currency)
const STATIC_RATES_UAH: Record<string, number> = {
  UAH: 1,
  USD: 41.50,
  EUR: 45.20,
  PLN: 10.40,
  GBP: 53.10,
  CHF: 47.80,
  MDL: 2.30,
  CZK: 1.80,
  CAD: 30.20,
  AUD: 27.10,
};

let _provider: CurrencyProvider = nbuProvider;

export const currencyService = {
  // ── Provider management ──────────────────────────────────────────────────

  setProvider(provider: CurrencyProvider): void {
    _provider = provider;
  },

  useNBU(): void {
    _provider = nbuProvider;
  },

  useManual(): void {
    _provider = manualProvider;
  },

  // ── Rate retrieval ───────────────────────────────────────────────────────

  /**
   * Get rate: how many units of `to` equals 1 unit of `from`.
   * Tries: IndexedDB cache (closest date) → live fetch → latest cached → static fallback.
   * NEVER throws an uncaught exception so transaction creation never fails.
   */
  async getRate(from: CurrencyCode, to: CurrencyCode, onDate?: string): Promise<number> {
    if (from === to) return 1;

    const lookupDate = onDate ?? today();

    // 1. Try IndexedDB cache — find closest rate on or before lookupDate
    const cached = await currencyService.getRateForDate(from, to, lookupDate);
    if (cached !== null && cached > 0) return cached;

    // 2. Try reverse direction in cache
    const reverseCached = await currencyService.getRateForDate(to, from, lookupDate);
    if (reverseCached !== null && reverseCached > 0) return 1 / reverseCached;

    // 3. Try fetching live rates (via NBUProvider with CORS proxy & fallbacks)
    const rateMode = await db.settings.get('currencyRateMode');
    if (rateMode?.value !== 'manual') {
      try {
        await currencyService.refreshRates();
        const fresh = await currencyService.getRateForDate(from, to, today());
        if (fresh !== null && fresh > 0) return fresh;
      } catch {
        // network / API offline — continue
      }
    }

    // 4. Try any cached rate regardless of date
    const anyRate = await currencyService.getLatestCachedRate(from, to);
    if (anyRate !== null && anyRate > 0) return anyRate;

    // 5. Static fallback calculation (UAH-based cross-rate)
    const fromInUAH = STATIC_RATES_UAH[from] ?? 1;
    const toInUAH = STATIC_RATES_UAH[to] ?? 1;
    const fallbackRate = fromInUAH / toInUAH;

    // Save static fallback rate to IndexedDB so it exists for future queries
    try {
      await currencyService.setManualRate(from, to, fallbackRate, lookupDate);
    } catch {
      // ignore IndexedDB write errors
    }

    return fallbackRate;
  },

  /**
   * Get the best cached rate for a currency pair on or before a given date.
   */
  async getRateForDate(
    from: CurrencyCode,
    to: CurrencyCode,
    date: string,
  ): Promise<number | null> {
    if (from === to) return 1;

    const minDate = '2000-01-01';
    const rates = await db.exchangeRates
      .where('[fromCurrency+toCurrency+date]')
      .between([from, to, minDate], [from, to, date], true, true)
      .toArray();

    if (rates.length > 0) {
      rates.sort((a, b) => b.date.localeCompare(a.date));
      return rates[0].rate;
    }

    return null;
  },

  /**
   * Get the most recently cached rate regardless of date.
   */
  async getLatestCachedRate(from: CurrencyCode, to: CurrencyCode): Promise<number | null> {
    if (from === to) return 1;

    const rates = await db.exchangeRates
      .where('fromCurrency')
      .equals(from)
      .filter((r) => r.toCurrency === to)
      .sortBy('date');

    if (rates.length > 0) {
      return rates[rates.length - 1].rate;
    }
    return null;
  },

  // ── Conversion ───────────────────────────────────────────────────────────

  convert(amount: number, rate: number): number {
    return Math.round(amount * rate * 100) / 100;
  },

  // ── Refresh from provider ────────────────────────────────────────────────

  async refreshRates(baseCurrency?: CurrencyCode): Promise<void> {
    const rateMode = await db.settings.get('currencyRateMode');
    if (rateMode?.value === 'manual') return;

    const base =
      baseCurrency ??
      (((await db.settings.get('baseCurrency'))?.value as string) || 'UAH');

    const rates = await _provider.getRates(base);
    const dateStr = today();
    const now = new Date().toISOString();
    const providerName = _provider.getName();

    const toSave: ExchangeRate[] = [];

    for (const [code, rate] of Object.entries(rates)) {
      if (code === base || rate <= 0) continue;

      toSave.push({
        id: generateId(),
        fromCurrency: base,
        toCurrency: code,
        rate,
        date: dateStr,
        source: 'api',
        provider: providerName,
        createdAt: now,
        updatedAt: now,
      });

      toSave.push({
        id: generateId(),
        fromCurrency: code,
        toCurrency: base,
        rate: 1 / rate,
        date: dateStr,
        source: 'api',
        provider: providerName,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.transaction('rw', db.exchangeRates, async () => {
      for (const rate of toSave) {
        const existing = await db.exchangeRates
          .where('[fromCurrency+toCurrency+date]')
          .equals([rate.fromCurrency, rate.toCurrency, rate.date])
          .first();

        if (existing) {
          await db.exchangeRates.update(existing.id, {
            rate: rate.rate,
            updatedAt: now,
            provider: providerName,
          });
        } else {
          await db.exchangeRates.add(rate);
        }
      }
    });

    await db.settings.put({ key: 'lastRatesUpdate', value: now });
  },

  // ── Manual rate entry ────────────────────────────────────────────────────

  async setManualRate(
    from: CurrencyCode,
    to: CurrencyCode,
    rate: number,
    onDate?: string,
  ): Promise<void> {
    const dateStr = onDate ?? today();
    const now = new Date().toISOString();

    const existing = await db.exchangeRates
      .where('[fromCurrency+toCurrency+date]')
      .equals([from, to, dateStr])
      .first();

    if (existing) {
      await db.exchangeRates.update(existing.id, {
        rate,
        source: 'manual',
        provider: undefined,
        updatedAt: now,
      });
    } else {
      await db.exchangeRates.add({
        id: generateId(),
        fromCurrency: from,
        toCurrency: to,
        rate,
        date: dateStr,
        source: 'manual',
        provider: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    const inverseExisting = await db.exchangeRates
      .where('[fromCurrency+toCurrency+date]')
      .equals([to, from, dateStr])
      .first();

    if (inverseExisting) {
      await db.exchangeRates.update(inverseExisting.id, {
        rate: 1 / rate,
        source: 'manual',
        updatedAt: now,
      });
    } else {
      await db.exchangeRates.add({
        id: generateId(),
        fromCurrency: to,
        toCurrency: from,
        rate: 1 / rate,
        date: dateStr,
        source: 'manual',
        provider: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  },

  // ── Utility ──────────────────────────────────────────────────────────────

  /**
   * Build a full currency-converted snapshot for a financial operation.
   * Safe method: never throws uncaught exception.
   */
  async buildSnapshot(
    amount: number,
    currency: CurrencyCode,
    baseCurrency: CurrencyCode,
    onDate?: string,
  ): Promise<{ exchangeRate: number; baseAmount: number; baseCurrency: CurrencyCode }> {
    if (currency === baseCurrency) {
      return { exchangeRate: 1, baseAmount: amount, baseCurrency };
    }

    try {
      const rate = await currencyService.getRate(currency, baseCurrency, onDate);
      const baseAmount = Math.round(amount * rate * 100) / 100;
      return { exchangeRate: rate, baseAmount, baseCurrency };
    } catch {
      return { exchangeRate: 1, baseAmount: amount, baseCurrency };
    }
  },
};
