import { incomePeriodService } from './incomePeriod';
import { balanceService } from './balance/balanceService';
import { savingsCalculator } from './savingsCalculator';
import { currencyService } from './currency/currencyService';
import { today } from '../utils/date';
import { db } from '../db/database';
import type { Forecast, CurrencyCode } from '../types';

export const forecastCalculator = {
  async getForecast(): Promise<Forecast | null> {
    const period = await incomePeriodService.getCurrentPeriod();
    if (!period) return null;

    const baseCurrencySetting = await db.settings.get('baseCurrency');
    const baseCurrency: CurrencyCode = (baseCurrencySetting?.value as string) || 'UAH';

    const currentBalance = await balanceService.currentBalance();

    let expectedIncomeBase = period.expectedIncome;
    if (period.expectedIncomeCurrency !== baseCurrency) {
      const rate = await currencyService.getRateForDate(period.expectedIncomeCurrency, baseCurrency, period.endDate) ?? 1;
      expectedIncomeBase = expectedIncomeBase * rate;
    }
    
    // plannedSavings: savings rule applied to expectedIncome
    let plannedSavingsBase = 0;
    const rule = await db.savingsRules.where('active').equals(1).filter(r => r.type !== 'none').first();
    if (rule) {
        const preview = await savingsCalculator.preview({
            amount: period.expectedIncome,
            currency: period.expectedIncomeCurrency,
            date: period.endDate
        }, rule, baseCurrency);
        if (preview) {
            plannedSavingsBase = preview.baseAmount;
        }
    }

    // Add future manual savings transactions within the period
    const futureSavings = await db.expenses
      .where('date')
      .between(today(), period.endDate, false, true)
      .toArray();
    for (const sav of futureSavings) {
      if (sav.categoryId === '__savings__' && sav.status === 'planned') {
        plannedSavingsBase += sav.baseAmount;
      }
    }

    // obligatoryExpenses: sum of planned expenses within period (in baseCurrency)
    const obligatoryExpensesBase = await incomePeriodService.getObligatorySum(period, baseCurrency);

    const forecastBalance = currentBalance.total + expectedIncomeBase - plannedSavingsBase - obligatoryExpensesBase;

    return {
      nextIncomeDate: period.endDate,
      expectedIncome: Math.round(expectedIncomeBase * 100) / 100,
      plannedSavings: Math.round(plannedSavingsBase * 100) / 100,
      obligatoryExpenses: obligatoryExpensesBase,
      forecastBalance: Math.round(forecastBalance * 100) / 100,
      isNegative: forecastBalance < 0,
      baseCurrency
    };
  }
};
