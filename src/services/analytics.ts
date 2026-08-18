import { db } from '../db/database';
import type { DailyExpense, CategoryBreakdown, MonthlyComparison } from '../types';
import { differenceInDays, startOfMonth, endOfMonth } from '../utils/date';
import { subMonths } from 'date-fns';

export const analyticsService = {
  async getDailyExpenses(from: string, to: string): Promise<DailyExpense[]> {
    const expenses = await db.expenses
      .where('date')
      .between(from, to, true, true)
      .filter(e => e.status !== 'cancelled')
      .toArray();

    const categories = await db.categories.toArray();
    const catMap = new Map(categories.map(c => [c.id, c]));

    const grouped: Record<string, DailyExpense & { cats: Set<string> }> = {};
    
    for (const exp of expenses) {
      if (!grouped[exp.date]) {
        grouped[exp.date] = { date: exp.date, amount: 0, count: 0, cats: new Set() };
      }
      grouped[exp.date].amount += exp.baseAmount;
      grouped[exp.date].count += 1;
      
      const cat = catMap.get(exp.categoryId);
      if (cat) {
        grouped[exp.date].cats.add(cat.name);
      } else if (exp.categoryId === '__savings__') {
        grouped[exp.date].cats.add('Накопление');
      }
    }

    return Object.values(grouped).map(g => {
      return {
        date: g.date,
        amount: g.amount,
        count: g.count,
        categoryNames: Array.from(g.cats).join(', ')
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  },

  async getCategoryBreakdown(from: string, to: string): Promise<CategoryBreakdown[]> {
    const expenses = await db.expenses
      .where('date')
      .between(from, to, true, true)
      .filter(e => e.status !== 'cancelled')
      .toArray();

    const categories = await db.categories.toArray();
    const catMap = new Map(categories.map(c => [c.id, c]));
    
    const grouped: Record<string, { amount: number; count: number }> = {};
    let total = 0;

    for (const exp of expenses) {
      if (!grouped[exp.categoryId]) {
        grouped[exp.categoryId] = { amount: 0, count: 0 };
      }
      grouped[exp.categoryId].amount += exp.baseAmount;
      grouped[exp.categoryId].count += 1;
      total += exp.baseAmount;
    }

    const result: CategoryBreakdown[] = Object.keys(grouped).map(categoryId => {
      const data = grouped[categoryId];
      const cat = catMap.get(categoryId);
      let name = cat?.name || 'Другое';
      let icon = cat?.icon || '📦';
      let color = '#9ca3af';

      if (categoryId === '__savings__') {
        name = 'Накопление';
        icon = '🐷';
        color = '#3a7ca5';
      }

      return {
        categoryId,
        categoryName: name,
        categoryIcon: icon,
        categoryColor: color,
        amount: data.amount,
        percentage: total > 0 ? (data.amount / total) * 100 : 0,
        count: data.count
      };
    });

    return result.sort((a, b) => b.amount - a.amount);
  },

  async getMonthlyComparison(months: number): Promise<MonthlyComparison[]> {
    const result: MonthlyComparison[] = [];
    const todayDate = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(todayDate, i);
      const year = monthDate.getFullYear();
      const month = String(monthDate.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${month}`;
      
      const start = startOfMonth(`${monthStr}-01`);
      const end = endOfMonth(`${monthStr}-01`);

      const inc = await this.getTotalIncome(start, end);
      const exp = await this.getTotalExpenses(start, end);
      const sav = await this.getTotalSavings(start, end);

      result.push({
        month: monthStr,
        income: inc,
        expenses: exp,
        savings: sav,
        balance: inc - exp - sav
      });
    }

    return result;
  },

  async getAverageDailySpend(from: string, to: string): Promise<number> {
    const total = await this.getTotalExpenses(from, to);
    let days = differenceInDays(from, to) + 1;
    if (days <= 0) days = 1;
    return total / days;
  },

  async getTotalIncome(from: string, to: string): Promise<number> {
    const incomes = await db.incomes
      .where('date')
      .between(from, to, true, true)
      .toArray();

    return incomes.reduce((sum, inc) => sum + inc.baseAmount, 0);
  },

  async getTotalExpenses(from: string, to: string): Promise<number> {
    const expenses = await db.expenses
      .where('date')
      .between(from, to, true, true)
      .filter(e => e.status !== 'cancelled' && e.categoryId !== '__savings__')
      .toArray();

    return expenses.reduce((sum, exp) => sum + exp.baseAmount, 0);
  },

  async getTotalSavings(from: string, to: string): Promise<number> {
    const savingsExpenses = await db.expenses
      .where('date')
      .between(from, to, true, true)
      .filter(e => e.categoryId === '__savings__' && e.status !== 'cancelled')
      .toArray();
      
    return savingsExpenses.reduce((sum, s) => sum + s.baseAmount, 0);
  },
};
