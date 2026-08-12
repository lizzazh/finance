import Dexie, { type Table } from 'dexie';
import type { Expense, Income, RecurringIncome, RecurringExpense, SavingsRule, SavingsTransaction, BalanceAdjustment, ExchangeRate, Category, Setting } from '../types';

export class FinanceDB extends Dexie {
  expenses!: Table<Expense, string>;
  incomes!: Table<Income, string>;
  recurringIncomes!: Table<RecurringIncome, string>;
  recurringExpenses!: Table<RecurringExpense, string>;
  savingsRules!: Table<SavingsRule, string>;
  savingsTransactions!: Table<SavingsTransaction, string>;
  balanceAdjustments!: Table<BalanceAdjustment, string>;
  exchangeRates!: Table<ExchangeRate, string>;
  categories!: Table<Category, string>;
  settings!: Table<Setting, string>;
  
  constructor() {
    super('FinancePlannerDB');
    this.version(1).stores({
      expenses: 'id, date, status, categoryId, recurringExpenseId, currency, createdAt',
      incomes: 'id, date, isRecurring, recurringIncomeId, savingsApplied, currency, createdAt',
      recurringIncomes: 'id, nextDate, active, frequency',
      recurringExpenses: 'id, nextDate, active, categoryId, frequency',
      savingsRules: 'id, type, active',
      savingsTransactions: 'id, incomeId, date, ruleId',
      balanceAdjustments: 'id, date, type',
      exchangeRates: 'id, [fromCurrency+toCurrency+date], date, fromCurrency, toCurrency',
      categories: 'id, type, isDefault',
      settings: 'key'
    });
  }
}

export const db = new FinanceDB();
