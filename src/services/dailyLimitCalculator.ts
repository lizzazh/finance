import { db } from '../db/database';
import { balanceService } from './balance/balanceService';
import { incomePeriodService } from './incomePeriod';
import { differenceInDays, today } from '../utils/date';
import type { CurrencyCode } from '../types';

/**
 * dailyLimitCalculator — computes how much the user can safely spend today.
 *
 * Formula:
 *   daysAvailable = max(1, differenceInCalendarDays(nextIncomeDate, today))
 *   dailyLimit    = availableBalance / daysAvailable
 *
 * Boundary cases:
 *   - next income is today     → daysAvailable = 1
 *   - next income is tomorrow  → daysAvailable = 1
 *   - next income in 3 days    → daysAvailable = 3
 *   - no income planned        → use 30 days fallback
 */
export const dailyLimitCalculator = {
  async calculate(): Promise<{
    dailyLimit: number;
    daysAvailable: number;
    nextIncomeDate: string | null;
    availableBalance: number;
    baseCurrency: CurrencyCode;
  }> {
    const baseCurrencySetting = await db.settings.get('baseCurrency');
    const baseCurrency: CurrencyCode =
      (baseCurrencySetting?.value as string) || 'UAH';

    const todayStr = today();

    // Get available balance (already deducts planned expenses and savings)
    const available = await balanceService.availableBalance();

    // Get next income date
    const period = await incomePeriodService.getCurrentPeriod();
    const nextIncomeDate = period?.endDate ?? null;

    let daysAvailable: number;

    if (!nextIncomeDate || nextIncomeDate <= todayStr) {
      // Income today or no income planned — spend for today only (then recalculate)
      daysAvailable = 1;
    } else {
      const diff = differenceInDays(todayStr, nextIncomeDate);
      daysAvailable = Math.max(1, diff);
    }

    const dailyLimit = Math.round((available / daysAvailable) * 100) / 100;

    return {
      dailyLimit: Math.max(0, dailyLimit),
      daysAvailable,
      nextIncomeDate,
      availableBalance: available,
      baseCurrency,
    };
  },
};
