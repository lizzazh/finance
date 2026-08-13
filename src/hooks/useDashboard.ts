import { useState, useEffect, useCallback } from 'react';
import type { DashboardData, UpcomingEvent, Expense } from '../types';
import { balanceService } from '../services/balance/balanceService';
import { dailyLimitCalculator } from '../services/dailyLimitCalculator';
import { incomePeriodService } from '../services/incomePeriod';
import { forecastCalculator } from '../services/forecastCalculator';
import { expensesRepo, recurringIncomesRepo } from '../db/repositories';
import { analyticsService } from '../services/analytics';
import { db } from '../db/database';
import { startOfMonth, endOfMonth, today, differenceInDays, addDays } from '../utils/date';
import { currencyService } from '../services/currency/currencyService';

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const currentDate = today();
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const baseCurrencySetting = await db.settings.get('baseCurrency');
      const baseCurrency = (baseCurrencySetting?.value as string) || 'UAH';
      const monthlyBudgetSetting = await db.settings.get('monthlyBudget');
      const monthlyBudget = (monthlyBudgetSetting?.value as number) || 0;

      const [
        currentBalance,
        limitData,
        period,
        forecast,
        monthlyExpenses,
        monthlyIncome,
        monthlySavings,
        recentExpenses,
        cats
      ] = await Promise.all([
        balanceService.currentBalance(),
        dailyLimitCalculator.calculate(),
        incomePeriodService.getCurrentPeriod(),
        forecastCalculator.getForecast(),
        analyticsService.getTotalExpenses(monthStart, monthEnd),
        analyticsService.getTotalIncome(monthStart, monthEnd),
        analyticsService.getTotalSavings(monthStart, monthEnd),
        expensesRepo.getRecent(5),
        db.categories.toArray()
      ]);

      const categoriesMap = new Map(cats.map(c => [c.id, c]));

      // Upcoming Events (next 7 days)
      const next7Days = addDays(currentDate, 7);
      const upcomingEvents: UpcomingEvent[] = [];

      // 1. Planned expenses
      const plannedExpenses = await expensesRepo.getByDateRange(currentDate, next7Days);
      for (const exp of plannedExpenses.filter(e => e.status === 'planned')) {
        const cat = categoriesMap.get(exp.categoryId);
        let name = cat?.name || 'Плановый расход';
        if (exp.description) {
          name = `${name} (${exp.description})`;
        }
        
        upcomingEvents.push({
          date: exp.date,
          type: 'expense',
          name,
          amount: exp.amount,
          currency: exp.currency,
          baseAmount: exp.baseAmount,
          daysUntil: differenceInDays(currentDate, exp.date),
          icon: cat?.icon
        });
      }

      // 2. Upcoming recurring incomes
      const activeIncomes = await recurringIncomesRepo.getActive();
      for (const inc of activeIncomes) {
        if (inc.nextDate >= currentDate && inc.nextDate <= next7Days) {
          const rate = await currencyService.getRateForDate(inc.currency, baseCurrency, inc.nextDate) ?? 1;
          upcomingEvents.push({
            date: inc.nextDate,
            type: 'income',
            name: inc.name,
            amount: inc.amount,
            currency: inc.currency,
            baseAmount: inc.amount * rate,
            daysUntil: differenceInDays(currentDate, inc.nextDate),
            icon: '💰'
          });
        }
      }

      upcomingEvents.sort((a, b) => a.date.localeCompare(b.date));

      setData({
        currentBalance,
        availableBalance: limitData.availableBalance,
        dailyLimit: limitData.dailyLimit,
        monthlyExpenses,
        monthlyIncome,
        monthlySavings,
        monthlyBudget,
        forecast,
        period,
        recentExpenses: recentExpenses.filter((e: Expense) => e.status !== 'planned'),
        upcomingEvents
      });
      setError(null);
    } catch (err) {
      console.error('Error loading dashboard data', err);
      setError('Не удалось загрузить данные дашборда');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
