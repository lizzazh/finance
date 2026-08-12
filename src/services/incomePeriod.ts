import { db } from '../db/database';
import { currencyService } from './currency/currencyService';
import type { IncomePeriod, CurrencyCode } from '../types';
import { today, isSameOrBefore } from '../utils/date';

/**
 * incomePeriod — determines the current financial planning period.
 *
 * A period is the span between the last income date and the next
 * expected income date for the primary income source (planningIncomeSourceId).
 *
 * Other incomes (freelance, bonuses) increase available balance
 * but do NOT change period boundaries.
 */
export const incomePeriodService = {
  async getCurrentPeriod(): Promise<IncomePeriod | null> {
    const todayStr = today();

    const sourceIdSetting = await db.settings.get('planningIncomeSourceId');
    const sourceId = sourceIdSetting?.value as string | null;

    let source = sourceId ? await db.recurringIncomes.get(sourceId) : null;

    // Fallback: pick the soonest upcoming active recurring income
    if (!source || !source.active) {
      const actives = await db.recurringIncomes
        .where('active')
        .equals(1)
        .toArray();
      source = actives.sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0] ?? null;
    }

    if (!source) return null;

    // Period: from the most recent past income date → next income date
    // Find last actual income created from this recurring source
    const pastIncomes = await db.incomes
      .where('recurringIncomeId')
      .equals(source.id)
      .filter((i) => i.date <= todayStr)
      .sortBy('date');

    const startDate =
      pastIncomes.length > 0 ? pastIncomes[pastIncomes.length - 1].date : todayStr;

    const endDate = source.nextDate;

    return {
      startDate,
      endDate,
      planningIncomeSourceId: source.id,
      expectedIncome: source.amount,
      expectedIncomeCurrency: source.currency,
    };
  },

  /**
   * Get planned+recurring expenses that fall within [period.startDate, period.endDate].
   * These are what get deducted when computing availableBalance and dailyLimit.
   */
  async getObligatoryWithinPeriod(period: IncomePeriod) {
    return db.expenses
      .where('status')
      .equals('planned')
      .filter(
        (e) =>
          e.date >= period.startDate &&
          isSameOrBefore(e.date, period.endDate),
      )
      .toArray();
  },

  /**
   * Sum obligatory expenses within period, converted to baseCurrency.
   */
  async getObligatorySum(
    period: IncomePeriod,
    baseCurrency: CurrencyCode,
  ): Promise<number> {
    const expenses = await incomePeriodService.getObligatoryWithinPeriod(period);
    let sum = 0;

    for (const exp of expenses) {
      if (exp.currency === baseCurrency) {
        sum += exp.amount;
      } else {
        const rate = await currencyService.getRateForDate(
          exp.currency,
          baseCurrency,
          exp.date,
        );
        if (rate !== null) {
          sum += exp.amount * rate;
        }
      }
    }

    return Math.round(sum * 100) / 100;
  },
};
