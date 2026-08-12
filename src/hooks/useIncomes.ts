import { useState, useEffect, useCallback } from 'react';
import type { Income } from '../types';
import { incomesRepo, savingsTransactionsRepo } from '../db/repositories';
import { generateId } from '../utils/id';
import { savingsCalculator } from '../services/savingsCalculator';

export function useIncomes() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await incomesRepo.getAll();
      data.sort((a, b) => b.date.localeCompare(a.date));
      setIncomes(data);
    } catch (err) {
      console.error('Error loading incomes', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addIncome = async (data: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const income: Income = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await incomesRepo.add(income);
    await savingsCalculator.applySavingsRule(income.id);
    refresh();
    return income.id;
  };

  const updateIncome = async (id: string, data: Partial<Income>) => {
    await incomesRepo.update(id, { ...data, updatedAt: new Date().toISOString() });
    refresh();
  };

  const deleteIncome = async (id: string) => {
    // Delete associated savings transactions first
    const savings = await savingsTransactionsRepo.getByIncomeId(id);
    for (const sav of savings) {
      await savingsTransactionsRepo.delete(sav.id);
    }
    await incomesRepo.delete(id);
    refresh();
  };

  return {
    incomes,
    loading,
    addIncome,
    updateIncome,
    deleteIncome,
    refresh
  };
}
