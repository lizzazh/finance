import { db } from '../../db/database';
import { currencyService } from '../currency/currencyService';
import type { CurrentBalance, CurrencyCode } from '../../types';
import { today, isSameOrBefore } from '../../utils/date';

/**
 * balanceService — computes the two core financial figures shown on Dashboard:
 *
 * currentBalance  = all completed incomes + balance adjustments − all completed expenses
 *                   (converted to baseCurrency using historical rates per operation)
 *
 * availableBalance = currentBalance
 *                   − obligatory planned expenses within current income period
 *                   − pending savings transactions (from current period's incomes)
 */
export const balanceService = {
  /**
   * Compute the total real balance across all currencies.
   * Uses historical exchangeRate stored on each record (snapshot at operation time).
   * Also returns a per-currency breakdown for display.
   */
  async currentBalance(): Promise<CurrentBalance> {
    const baseCurrencySetting = await db.settings.get('baseCurrency');
    const baseCurrency: CurrencyCode =
      (baseCurrencySetting?.value as string) || 'UAH';

    const [adjustments, incomes, expenses] = await Promise.all([
      db.balanceAdjustments.toArray(),
      db.incomes.toArray(),
      db.expenses.where('status').equals('completed').toArray(),
    ]);

    const byCurrency: Record<string, number> = {};
    let total = 0;

    // Helper: add an amount in a given currency to both total and byCurrency
    const addAmount = async (
      amount: number,
      currency: CurrencyCode,
      historicalRate: number | null,
      date: string,
    ) => {
      // byCurrency tracks original amounts
      byCurrency[currency] = (byCurrency[currency] ?? 0) + amount;

      // For total, convert to baseCurrency
      if (currency === baseCurrency) {
        total += amount;
      } else {
        // Use historical rate stored on the record if available and currency matches
        // Otherwise look up in IndexedDB by date
        const rate =
          historicalRate !== null && historicalRate > 0
            ? historicalRate
            : await currencyService.getRateForDate(currency, baseCurrency, date)
                .then((r) => r ?? 0);

        total += amount * rate;
      }
    };

    // Balance adjustments
    for (const adj of adjustments) {
      await addAmount(adj.amount, adj.currency, adj.exchangeRate, adj.date);
    }

    // Received / Completed incomes
    for (const inc of incomes) {
      if (inc.status === 'pending') continue;
      await addAmount(inc.amount, inc.currency, inc.exchangeRate, inc.date);
    }

    // Expenses and savings are both in the expenses table (subtract)
    for (const exp of expenses) {
      await addAmount(-exp.amount, exp.currency, exp.exchangeRate, exp.date);
    }

    // Round total
    total = Math.round(total * 100) / 100;

    // Round per-currency
    for (const code of Object.keys(byCurrency)) {
      byCurrency[code] = Math.round(byCurrency[code] * 100) / 100;
    }

    return { total, byCurrency, baseCurrency };
  },

  /**
   * Compute available balance:
   * currentBalance.total
   * − sum of planned obligatory expenses with date <= nextIncomeDate
   * − sum of savingsTransactions for incomes in the current period
   */
  async getAvailableBalances(): Promise<{ availableBalance: number, availableAfterSavings: number }> {
    const { total, baseCurrency } = await balanceService.currentBalance();

    const todayStr = today();

    // Get next income date from planningIncomeSourceId
    const sourceIdSetting = await db.settings.get('planningIncomeSourceId');
    const sourceId = sourceIdSetting?.value as string | null;

    let nextIncomeDate: string | null = null;

    if (sourceId) {
      const source = await db.recurringIncomes.get(sourceId);
      if (source?.active) {
        nextIncomeDate = source.nextDate;
      }
    }

    if (!nextIncomeDate) {
      // Fallback: find the soonest upcoming recurring income
      const upcoming = await db.recurringIncomes
        .where('active')
        .equals(1)
        .filter((r) => r.nextDate >= todayStr)
        .sortBy('nextDate');
      nextIncomeDate = upcoming[0]?.nextDate ?? null;
    }

    const periodEnd = nextIncomeDate ?? '9999-12-31';

    // Planned expenses within period (date <= nextIncomeDate)
    const plannedExpenses = await db.expenses
      .where('status')
      .equals('planned')
      .filter((e) => isSameOrBefore(e.date, periodEnd))
      .toArray();

    let obligatoryDeduction = 0;
    let savingsDeduction = 0;

    for (const exp of plannedExpenses) {
      let amount = exp.amount;
      if (exp.currency !== baseCurrency) {
        const rate = await currencyService.getRateForDate(
          exp.currency,
          baseCurrency,
          exp.date,
        );
        amount = amount * (rate ?? 1);
      }
      
      if (exp.categoryId === '__savings__') {
        savingsDeduction += amount;
      } else {
        obligatoryDeduction += amount;
      }
    }

    const availableBalance = total - obligatoryDeduction;
    const availableAfterSavings = availableBalance - savingsDeduction;

    return {
      availableBalance: Math.round(availableBalance * 100) / 100,
      availableAfterSavings: Math.round(availableAfterSavings * 100) / 100
    };
  },
};
