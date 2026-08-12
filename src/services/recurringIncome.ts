import { recurringIncomesRepo, incomesRepo } from '../db/repositories';
import { getNextRecurringDate, isSameOrBefore, today } from '../utils/date';
import { generateId } from '../utils/id';
import { savingsCalculator } from './savingsCalculator';
import type { Income } from '../types';
import { currencyService } from './currency/currencyService';
import { db } from '../db/database';

export const recurringIncomeService = {
  async processAll(): Promise<void> {
    const activeRecurring = await recurringIncomesRepo.getActive();
    for (const recurring of activeRecurring) {
      await this.processSingle(recurring.id);
    }
  },

  async processSingle(recurringIncomeId: string): Promise<void> {
    const recurring = await recurringIncomesRepo.get(recurringIncomeId);
    if (!recurring || !recurring.active) return;

    let nextDate = recurring.nextDate;
    const currentDate = today();
    let updated = false;

    while (isSameOrBefore(nextDate, currentDate)) {
      if (recurring.endDate && nextDate > recurring.endDate) break;
      // Protection against duplicates: check (recurringIncomeId, date)
      const existingIncomes = await incomesRepo.getByDateRange(nextDate, nextDate);
      const isDuplicate = existingIncomes.some(inc => inc.recurringIncomeId === recurring.id);

      if (!isDuplicate) {
        const baseCurrencySetting = await db.settings.get('baseCurrency');
        const baseCurrency = (baseCurrencySetting?.value as string) || 'UAH';
        const exchangeRate = await currencyService.getRateForDate(recurring.currency, baseCurrency, nextDate) ?? 1;
        const baseAmount = Math.round(recurring.amount * exchangeRate * 100) / 100;

        const income: Income = {
          id: generateId(),
          amount: recurring.amount,
          currency: recurring.currency,
          exchangeRate,
          baseAmount,
          baseCurrency,
          name: recurring.name,
          description: `Сгенерировано автоматически (повторяющийся доход)`,
          date: nextDate,
          isRecurring: true,
          recurringIncomeId: recurring.id,
          savingsApplied: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await incomesRepo.add(income);
        await savingsCalculator.applySavingsRule(income.id);
      }

      nextDate = getNextRecurringDate(nextDate, recurring.frequency, recurring.dayOfMonth, recurring.customIntervalDays);
      updated = true;
    }

    if (updated) {
      await recurringIncomesRepo.update(recurring.id, { nextDate, updatedAt: new Date().toISOString() });
    }
  }
};
