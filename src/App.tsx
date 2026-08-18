import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { db } from './db/database';
import { AppLayout } from './components/ui/AppLayout';
import { useSettings } from './hooks/useSettings';
import { seedDatabase } from './db/seed';
import { recurringIncomeService } from './services/recurringIncome';
import { recurringExpensesService } from './services/recurringExpenses';
import { currencyService } from './services/currency/currencyService';

import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Income from './pages/Income';
import Recurring from './pages/Recurring';
import CalendarPage from './pages/Calendar';
import Analytics from './pages/Analytics';
import SettingsPage from './pages/Settings';

export default function App() {
  const { settings, loading } = useSettings();
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    async function init() {
      if (loading) return;
      try {
        // Migrate savingsTransactions to expenses
        const allSavings = await db.savingsTransactions.toArray();
        if (allSavings.length > 0) {
          const newExpenses = allSavings.map(s => ({
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
          await db.savingsTransactions.clear();
        }

        await seedDatabase();
        await recurringIncomeService.processAll();
        await recurringExpensesService.processAll();
        if (settings?.currencyRateMode === 'auto') {
          try {
            await currencyService.refreshRates();
          } catch {}
        }
        try {
          const { reminderService } = await import('./services/reminderService');
          await reminderService.triggerNativeNotifications();
        } catch {}
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setInitDone(true);
      }
    }
    init();
  }, [loading, settings?.currencyRateMode]);

  if (!initDone) {
    return <div className="flex h-screen items-center justify-center">Загрузка...</div>;
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/income" element={<Income />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
