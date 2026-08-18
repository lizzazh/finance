import { recurringExpensesRepo, expensesRepo } from '../db/repositories';
import { getNextRecurringDate, isSameOrBefore, today, addDays } from '../utils/date';
import { generateId } from '../utils/id';
import type { Expense } from '../types';
import { currencyService } from './currency/currencyService';
import { db } from '../db/database';

export const recurringExpensesService = {
  async processAll(): Promise<void> {
    const activeRecurring = await recurringExpensesRepo.getActive();
    for (const recurring of activeRecurring) {
      await this.processSingle(recurring.id);
    }
  },

  async processSingle(recurringExpenseId: string): Promise<void> {
    const recurring = await recurringExpensesRepo.get(recurringExpenseId);
    if (!recurring || !recurring.active) return;

    let nextDate = recurring.nextDate;
    // We want to generate expenses up to 30 days in the future
    const cutoffDate = addDays(today(), 30);
    let updated = false;

    while (isSameOrBefore(nextDate, cutoffDate)) {
      if (recurring.endDate && nextDate > recurring.endDate) break;
      
      let isDuplicate = false;
      if (recurring.categoryId === '__savings__') {
        const existingSavings = await db.savingsTransactions.where('recurringExpenseId').equals(recurring.id).toArray();
        isDuplicate = existingSavings.some(s => s.date === nextDate);
      } else {
        const existingExpenses = await expensesRepo.getByDateRange(nextDate, nextDate);
        isDuplicate = existingExpenses.some(exp => exp.recurringExpenseId === recurring.id);
      }

      if (!isDuplicate) {
        const baseCurrencySetting = await db.settings.get('baseCurrency');
        const baseCurrency = (baseCurrencySetting?.value as string) || 'UAH';
        const exchangeRate = await currencyService.getRateForDate(recurring.currency, baseCurrency, nextDate) ?? 1;
        const baseAmount = Math.round(recurring.amount * exchangeRate * 100) / 100;

        if (recurring.categoryId === '__savings__') {
          // It's a recurring savings!
          const ruleType = recurring.amountMode === 'percentage_of_income' ? 'percentage' : 'fixed';
          const ruleValue = recurring.amountMode === 'percentage_of_income' && recurring.percentageValue ? recurring.percentageValue : recurring.amount;
          
          await db.savingsTransactions.add({
            id: generateId(),
            incomeId: recurring.amountMode === 'percentage_of_income' && recurring.percentageIncomeId ? recurring.percentageIncomeId : 'manual',
            amount: recurring.amount,
            currency: recurring.currency,
            exchangeRate,
            baseAmount,
            baseCurrency,
            ruleId: 'manual',
            ruleType,
            ruleValue,
            date: nextDate,
            recurringExpenseId: recurring.id,
            createdAt: new Date().toISOString()
          });
        } else {
          const expense: Expense = {
            id: generateId(),
            amount: recurring.amount,
            currency: recurring.currency,
            exchangeRate,
            baseAmount,
            baseCurrency,
            categoryId: recurring.categoryId,
            description: recurring.name,
            date: nextDate,
            status: 'planned',
            recurringExpenseId: recurring.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await expensesRepo.add(expense);
        }
      }

      nextDate = getNextRecurringDate(nextDate, recurring.frequency, recurring.dayOfMonth, recurring.customIntervalDays);
      updated = true;
    }

    if (updated) {
      await recurringExpensesRepo.update(recurring.id, { nextDate, updatedAt: new Date().toISOString() });
    }
  },

  async getUpcoming(daysAhead: number): Promise<Expense[]> {
    const currentDate = today();
    const futureDate = addDays(currentDate, daysAhead);
    
    const expenses = await expensesRepo.getByDateRange(currentDate, futureDate);
    return expenses.filter(e => e.status === 'planned' && e.recurringExpenseId);
  }
};
