import { db } from '../db/database';
import type { ExportData, CurrencyCode } from '../types';

const SCHEMA_VERSION = 1;

export const exportImportService = {
  async exportData(): Promise<ExportData> {
    const baseCurrencySetting = await db.settings.get('baseCurrency');
    const baseCurrency = (baseCurrencySetting?.value as CurrencyCode) || 'UAH';

    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      baseCurrency,
      data: {
        expenses: await db.expenses.toArray(),
        incomes: await db.incomes.toArray(),
        recurringIncomes: await db.recurringIncomes.toArray(),
        recurringExpenses: await db.recurringExpenses.toArray(),
        savingsRules: await db.savingsRules.toArray(),
        balanceAdjustments: await db.balanceAdjustments.toArray(),
        exchangeRates: await db.exchangeRates.toArray(),
        categories: await db.categories.toArray(),
        settings: await db.settings.toArray(),
      }
    };
  },

  async clearAllData(): Promise<void> {
    // Keep default categories and settings
    const defaultCategories = await db.categories.where('isDefault').equals(1).toArray();
    const allSettings = await db.settings.toArray();

    await Promise.all([
      db.expenses.clear(),
      db.incomes.clear(),
      db.recurringIncomes.clear(),
      db.recurringExpenses.clear(),
      db.savingsRules.clear(),
      db.balanceAdjustments.clear(),
      db.exchangeRates.clear(),
      db.categories.clear(),
      db.settings.clear()
    ]);

    if (defaultCategories.length > 0) {
      await db.categories.bulkAdd(defaultCategories);
    }
    if (allSettings.length > 0) {
      await db.settings.bulkAdd(allSettings);
    }
  },

  async importData(data: ExportData): Promise<void> {
    if (data.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`Unsupported schema version: ${data.schemaVersion}`);
    }

    await this.clearAllData();

    await Promise.all([
      db.expenses.bulkPut(data.data.expenses || []),
      db.incomes.bulkPut(data.data.incomes || []),
      db.recurringIncomes.bulkPut(data.data.recurringIncomes || []),
      db.recurringExpenses.bulkPut(data.data.recurringExpenses || []),
      db.savingsRules.bulkPut(data.data.savingsRules || []),
      db.balanceAdjustments.bulkPut(data.data.balanceAdjustments || []),
      db.exchangeRates.bulkPut(data.data.exchangeRates || []),
      db.categories.bulkPut(data.data.categories || []),
      db.settings.bulkPut(data.data.settings || [])
    ]);

    // Handle legacy savingsTransactions from older exports
    if ((data.data as any).savingsTransactions && (data.data as any).savingsTransactions.length > 0) {
      const newExpenses = (data.data as any).savingsTransactions.map((s: any) => ({
        id: s.id,
        amount: s.amount,
        currency: s.currency,
        exchangeRate: s.exchangeRate,
        baseAmount: s.baseAmount,
        baseCurrency: s.baseCurrency,
        categoryId: '__savings__',
        description: s.ruleId === 'manual' ? 'Накопление' : 'Авто-накопление',
        date: s.date,
        status: s.date <= new Date().toISOString().slice(0, 10) ? 'completed' : 'planned',
        amountMode: s.ruleType === 'percentage' ? 'percentage_of_income' : 'fixed',
        percentageIncomeId: s.ruleType === 'percentage' ? s.incomeId : undefined,
        percentageValue: s.ruleType === 'percentage' ? s.ruleValue : undefined,
        recurringExpenseId: s.recurringExpenseId,
        createdAt: s.createdAt,
        updatedAt: s.createdAt,
      }));
      await db.expenses.bulkAdd(newExpenses as any);
    }
  },

  downloadJSON(data: ExportData): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance_planner_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async parseAndValidate(json: string): Promise<ExportData> {
    try {
      const data = JSON.parse(json) as ExportData;
      if (!data.schemaVersion || !data.data) {
        throw new Error('Invalid export file format');
      }
      return data;
    } catch (e) {
      throw new Error('Failed to parse export file');
    }
  }
};
