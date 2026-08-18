import { db } from '../database';
import type { Expense, Income, RecurringIncome, RecurringExpense, SavingsRule, SavingsTransaction, BalanceAdjustment, ExchangeRate, Category } from '../../types';

export const expensesRepo = {
  async add(expense: Expense) { return db.expenses.add(expense); },
  async update(id: string, expense: Partial<Expense>) { return db.expenses.update(id, expense); },
  async delete(id: string) { return db.expenses.delete(id); },
  async get(id: string) { return db.expenses.get(id); },
  async getAll() { return db.expenses.toArray(); },
  async getByDateRange(from: string, to: string) {
    return db.expenses.where('date').between(from, to, true, true).toArray();
  },
  async getByStatus(status: Expense['status']) {
    return db.expenses.where('status').equals(status).toArray();
  },
  async getByCategory(categoryId: string) {
    return db.expenses.where('categoryId').equals(categoryId).toArray();
  },
  async getRecent(limit: number) {
    return db.expenses.orderBy('date').reverse().limit(limit).toArray();
  }
};

export const incomesRepo = {
  async add(income: Income) { return db.incomes.add(income); },
  async update(id: string, income: Partial<Income>) { return db.incomes.update(id, income); },
  async delete(id: string) { return db.incomes.delete(id); },
  async get(id: string) { return db.incomes.get(id); },
  async getAll() { return db.incomes.toArray(); },
  async getByDateRange(from: string, to: string) {
    return db.incomes.where('date').between(from, to, true, true).toArray();
  },
  async getBySavingsApplied(applied: boolean) {
    return db.incomes.filter(i => i.savingsApplied === applied).toArray();
  }
};

export const recurringIncomesRepo = {
  async add(item: RecurringIncome) { return db.recurringIncomes.add(item); },
  async update(id: string, item: Partial<RecurringIncome>) { return db.recurringIncomes.update(id, item); },
  async delete(id: string) { return db.recurringIncomes.delete(id); },
  async get(id: string) { return db.recurringIncomes.get(id); },
  async getAll() { return db.recurringIncomes.toArray(); },
  async getActive() { return db.recurringIncomes.filter(r => r.active).toArray(); }
};

export const recurringExpensesRepo = {
  async add(item: RecurringExpense) { return db.recurringExpenses.add(item); },
  async update(id: string, item: Partial<RecurringExpense>) { return db.recurringExpenses.update(id, item); },
  async delete(id: string) { return db.recurringExpenses.delete(id); },
  async get(id: string) { return db.recurringExpenses.get(id); },
  async getAll() { return db.recurringExpenses.toArray(); },
  async getActive() { return db.recurringExpenses.filter(r => r.active).toArray(); },
  async getUpcoming(daysAhead: number) {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const to = futureDate.toISOString().split('T')[0];
    return db.recurringExpenses.where('nextDate').between(today, to, true, true).toArray();
  }
};

export const savingsRulesRepo = {
  async add(item: SavingsRule) { return db.savingsRules.add(item); },
  async update(id: string, item: Partial<SavingsRule>) { return db.savingsRules.update(id, item); },
  async delete(id: string) { return db.savingsRules.delete(id); },
  async get(id: string) { return db.savingsRules.get(id); },
  async getAll() { return db.savingsRules.toArray(); },
  async getActive() { return db.savingsRules.filter(r => r.active).toArray(); }
};

export const balanceAdjustmentsRepo = {
  async add(item: BalanceAdjustment) { return db.balanceAdjustments.add(item); },
  async update(id: string, item: Partial<BalanceAdjustment>) { return db.balanceAdjustments.update(id, item); },
  async delete(id: string) { return db.balanceAdjustments.delete(id); },
  async get(id: string) { return db.balanceAdjustments.get(id); },
  async getAll() {
    return db.balanceAdjustments.orderBy('date').reverse().toArray();
  }
};

export const exchangeRatesRepo = {
  async add(item: ExchangeRate) { return db.exchangeRates.add(item); },
  async update(id: string, item: Partial<ExchangeRate>) { return db.exchangeRates.update(id, item); },
  async delete(id: string) { return db.exchangeRates.delete(id); },
  async get(id: string) { return db.exchangeRates.get(id); },
  async getAll() { return db.exchangeRates.toArray(); },
  async saveRate(rate: ExchangeRate) {
    return db.exchangeRates.put(rate);
  },
  async getRateForDate(fromCurrency: string, toCurrency: string, date: string) {
    const rates = await db.exchangeRates
      .where('[fromCurrency+toCurrency+date]')
      .between([fromCurrency, toCurrency, ''], [fromCurrency, toCurrency, date], true, true)
      .reverse()
      .limit(1)
      .toArray();
    return rates.length > 0 ? rates[0] : null;
  }
};

export const categoriesRepo = {
  async add(item: Category) { return db.categories.add(item); },
  async update(id: string, item: Partial<Category>) { return db.categories.update(id, item); },
  async delete(id: string) { return db.categories.delete(id); },
  async get(id: string) { return db.categories.get(id); },
  async getAll() { return db.categories.toArray(); },
  async getByType(type: Category['type']) {
    return db.categories.where('type').equals(type).toArray();
  }
};

export const settingsRepo = {
  async get(key: string) {
    const setting = await db.settings.get(key);
    return setting?.value;
  },
  async set(key: string, value: any) {
    return db.settings.put({ key, value });
  },
  async getAll(): Promise<Record<string, any>> {
    const settings = await db.settings.toArray();
    const result: Record<string, any> = {};
    settings.forEach(s => { result[s.key] = s.value; });
    return result;
  },
  async setMultiple(settings: Record<string, any>) {
    const arr = Object.entries(settings).map(([key, value]) => ({ key, value }));
    return db.settings.bulkPut(arr);
  }
};
