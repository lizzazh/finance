import { db } from '../db/database';
import { currencyService } from './currency/currencyService';
import { generateId } from '../utils/id';
import type { Income, SavingsRule, Expense, CurrencyCode } from '../types';

/**
 * savingsCalculator — computes and atomically applies savings rules to incomes.
 *
 * Savings model:
 * - percentage: savingsAmount = income.amount × (rule.value / 100)
 *               currency = income.currency
 * - fixed: rule has its own currency; convert to income.currency by date rate
 *          savingsAmount = fixedAmount / rate(rule.currency → income.currency, income.date)
 *
 * IMPORTANT: savings transactions do NOT reduce currentBalance automatically if they are in the future (status: planned).
 * They only reduce currentBalance once they become 'completed'.
 *
 * Protection: one savings transaction per incomeId, enforced via IndexedDB transaction.
 */
export const savingsCalculator = {
  /**
   * Apply the active savings rule to a specific income.
   */
  async applySavingsRule(incomeId: string): Promise<Expense | null> {
    return db.transaction('rw', [db.incomes, db.expenses, db.savingsRules], async () => {
      // Check if already applied (source of truth: expenses table)
      const existing = await db.expenses
        .where('percentageIncomeId')
        .equals(incomeId)
        .first();

      if (existing) {
        // Already applied — ensure flag is consistent
        await db.incomes.update(incomeId, { savingsApplied: true });
        return null;
      }

      // Get the income
      const income = await db.incomes.get(incomeId);
      if (!income) return null;

      // Get active savings rule
      const rule = await db.savingsRules
        .where('active')
        .equals(1)
        .filter((r) => r.type !== 'none')
        .first();

      if (!rule || rule.type === 'none') {
        // No rule — mark as applied anyway to stop retrying
        await db.incomes.update(incomeId, { savingsApplied: true });
        return null;
      }

      const baseCurrencySetting = await db.settings.get('baseCurrency');
      const baseCurrency: CurrencyCode = (baseCurrencySetting?.value as string) || 'UAH';

      let savingsAmount: number;
      let savingsCurrency: CurrencyCode;

      if (rule.type === 'percentage') {
        savingsAmount = Math.round(income.amount * (rule.value / 100) * 100) / 100;
        savingsCurrency = income.currency;
      } else {
        // fixed — convert to income currency
        savingsCurrency = income.currency;
        const ruleCurrency = rule.currency ?? baseCurrency;

        if (ruleCurrency === income.currency) {
          savingsAmount = rule.value;
        } else {
          const rate = await currencyService.getRateForDate(
            ruleCurrency,
            income.currency,
            income.date,
          );
          if (rate === null) {
            throw new Error(
              `No rate available for ${ruleCurrency} → ${income.currency} on ${income.date}`,
            );
          }
          savingsAmount = Math.round(rule.value * rate * 100) / 100;
        }
      }

      // Build snapshot for savings transaction
      let exchangeRate = 1;
      let baseAmount = savingsAmount;

      if (savingsCurrency !== baseCurrency) {
        const rate = await currencyService.getRateForDate(
          savingsCurrency,
          baseCurrency,
          income.date,
        );
        exchangeRate = rate ?? 1;
        baseAmount = Math.round(savingsAmount * exchangeRate * 100) / 100;
      }

      const now = new Date().toISOString();
      const transaction: Expense = {
        id: generateId(),
        amount: savingsAmount,
        currency: savingsCurrency,
        exchangeRate,
        baseAmount,
        baseCurrency,
        categoryId: '__savings__',
        description: 'Авто-накопление',
        date: income.date,
        status: income.date <= now.slice(0, 10) ? 'completed' : 'planned',
        amountMode: rule.type === 'percentage' ? 'percentage_of_income' : 'fixed',
        percentageIncomeId: incomeId,
        percentageValue: rule.type === 'percentage' ? rule.value : undefined,
        createdAt: now,
        updatedAt: now,
      };

      await db.expenses.add(transaction);
      await db.incomes.update(incomeId, { savingsApplied: true });

      return transaction;
    });
  },

  /**
   * Preview what savings would be for a given income and rule (without saving).
   */
  async preview(
    income: Pick<Income, 'amount' | 'currency' | 'date'>,
    rule: SavingsRule,
    baseCurrency: CurrencyCode,
  ): Promise<{ amount: number; currency: CurrencyCode; baseAmount: number } | null> {
    if (rule.type === 'none') return null;

    if (rule.type === 'percentage') {
      const amount = Math.round(income.amount * (rule.value / 100) * 100) / 100;
      const rate =
        income.currency === baseCurrency
          ? 1
          : (await currencyService.getRateForDate(income.currency, baseCurrency, income.date)) ?? 1;
      return {
        amount,
        currency: income.currency,
        baseAmount: Math.round(amount * rate * 100) / 100,
      };
    }

    // fixed
    const ruleCurrency = rule.currency ?? baseCurrency;
    let amount: number;

    if (ruleCurrency === income.currency) {
      amount = rule.value;
    } else {
      const rate = await currencyService.getRateForDate(ruleCurrency, income.currency, income.date);
      amount = Math.round(rule.value * (rate ?? 1) * 100) / 100;
    }

    const toBaseRate =
      income.currency === baseCurrency
        ? 1
        : (await currencyService.getRateForDate(income.currency, baseCurrency, income.date)) ?? 1;

    return {
      amount,
      currency: income.currency,
      baseAmount: Math.round(amount * toBaseRate * 100) / 100,
    };
  },
};
