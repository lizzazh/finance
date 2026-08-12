import { useState, useEffect, useCallback } from 'react';
import type { Expense, ExpenseStatus } from '../types';
import { expensesRepo } from '../db/repositories';
import { generateId } from '../utils/id';

export function useExpenses(filters?: { from?: string; to?: string; status?: ExpenseStatus; categoryId?: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      let data: Expense[];

      if (filters?.from && filters?.to) {
        data = await expensesRepo.getByDateRange(filters.from, filters.to);
      } else {
        data = await expensesRepo.getAll();
      }

      if (filters?.status) {
        data = data.filter(e => e.status === filters.status);
      }
      
      if (filters?.categoryId) {
        data = data.filter(e => e.categoryId === filters.categoryId);
      }

      data.sort((a, b) => b.date.localeCompare(a.date));
      setExpenses(data);
    } catch (err) {
      console.error('Error loading expenses', err);
    } finally {
      setLoading(false);
    }
  }, [filters?.from, filters?.to, filters?.status, filters?.categoryId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addExpense = async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    const expense: Expense = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await expensesRepo.add(expense);
    refresh();
  };

  const updateExpense = async (id: string, data: Partial<Expense>) => {
    await expensesRepo.update(id, { ...data, updatedAt: new Date().toISOString() });
    refresh();
  };

  const deleteExpense = async (id: string) => {
    await expensesRepo.delete(id);
    refresh();
  };

  const markCompleted = async (id: string) => {
    await expensesRepo.update(id, { status: 'completed', updatedAt: new Date().toISOString() });
    refresh();
  };

  const markCancelled = async (id: string) => {
    await expensesRepo.update(id, { status: 'cancelled', updatedAt: new Date().toISOString() });
    refresh();
  };

  return {
    expenses,
    loading,
    addExpense,
    updateExpense,
    deleteExpense,
    markCompleted,
    markCancelled,
    refresh
  };
}
