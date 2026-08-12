import type { CurrencyProvider } from '../currencyProvider';
import type { CurrencyCode } from '../../../types';

interface NBURateEntry {
  r030: number;
  txt: string;
  rate: number;
  cc: string;
  exchangedate: string;
}

// Fallback rates dictionary in case network fails completely
const STATIC_FALLBACK_UAH_RATES: Record<string, number> = {
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
  JPY: 0.28,
  CNY: 5.75,
  HUF: 0.11,
  BGN: 23.10,
  RON: 9.08,
  SEK: 3.95,
  NOK: 3.90,
  DKK: 6.06,
  TRY: 1.25,
  ILS: 11.20,
};

export class NBUProvider implements CurrencyProvider {
  getName(): string {
    return 'NBU';
  }

  async getRates(baseCurrency: CurrencyCode): Promise<Record<CurrencyCode, number>> {
    let uahRates: Record<string, number> = { UAH: 1 };
    let success = false;

    // 1. Try open CORS-friendly public API (`open.er-api.com`)
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/UAH', {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.rates) {
          for (const [code, rate] of Object.entries(json.rates)) {
            const r = rate as number;
            if (r > 0) {
              uahRates[code] = 1 / r;
            }
          }
          success = true;
        }
      }
    } catch {
      // network offline
    }

    // 2. Try direct NBU API as secondary option
    if (!success) {
      try {
        const res = await fetch('https://bank.gov.ua/NBUStatService/v1/statdataservice/exchange?json', {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data: NBURateEntry[] = await res.json();
          for (const entry of data) {
            if (entry.cc && entry.rate > 0) {
              uahRates[entry.cc] = entry.rate;
            }
          }
          success = true;
        }
      } catch {
        // failed
      }
    }

    // 3. Fallback to static UAH rates if network calls fail
    if (!success) {
      uahRates = { ...STATIC_FALLBACK_UAH_RATES };
    }

    // Calculate rates for requested baseCurrency
    if (baseCurrency === 'UAH') {
      const result: Record<string, number> = { UAH: 1 };
      for (const [code, uahPerUnit] of Object.entries(uahRates)) {
        if (code !== 'UAH' && uahPerUnit > 0) {
          result[code] = 1 / uahPerUnit;
        }
      }
      return result;
    }

    // Cross-rate for non-UAH baseCurrency
    const baseInUAH = uahRates[baseCurrency] ?? STATIC_FALLBACK_UAH_RATES[baseCurrency] ?? 1;
    const result: Record<string, number> = {};
    for (const [code, uahPerUnit] of Object.entries(uahRates)) {
      if (uahPerUnit > 0) {
        result[code] = baseInUAH / uahPerUnit;
      }
    }
    result[baseCurrency] = 1;
    return result;
  }
}

export const nbuProvider = new NBUProvider();
