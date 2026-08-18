import { useState, useEffect } from 'react';
import { useDashboard } from '../../hooks/useDashboard';
import { AddExpenseModal } from '../../components/expenses/AddExpenseModal';
import { AddIncomeModal } from '../../components/incomes/AddIncomeModal';
import { formatAmount } from '../../utils/format';
import { analyticsService } from '../../services/analytics';
import { startOfMonth, endOfMonth, today, toDisplayDate, toDisplayMonth } from '../../utils/date';
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { Wallet, CalendarDays, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { DailyExpense } from '../../types';

export default function Dashboard() {
  const { data, loading, refresh } = useDashboard();
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [chartData, setChartData] = useState<DailyExpense[]>([]);

  useEffect(() => {
    if (data) {
      const curDate = today();
      analyticsService.getDailyExpenses(startOfMonth(curDate), endOfMonth(curDate))
        .then(setChartData);
    }
  }, [data]);

  if (loading || !data) {
    return <div className="p-4">Загрузка...</div>;
  }

  const {
    currentBalance,
    availableBalance,
    dailyLimit,
    monthlyExpenses,
    monthlyBudget,
    recentExpenses,
    upcomingEvents,
    forecast,
    availableAfterSavings
  } = data;

  const showWelcome = currentBalance.total === 0 && recentExpenses.length === 0 && upcomingEvents.length === 0;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <header className="sticky-header flex justify-between items-center">
        <h1 className="text-xl font-bold capitalize">{toDisplayMonth(today())}</h1>
      </header>

      {showWelcome ? (
        <div className="card text-center py-10 flex flex-col items-center gap-4">
          <h2 className="text-2xl font-bold">Добро пожаловать в Finance Planner!</h2>
          <p className="text-secondary max-w-md">Добавьте ваши первые доходы и расходы, чтобы начать планирование бюджета.</p>
          <div className="flex gap-4 mt-4">
            <button className="btn-secondary" onClick={() => setIncomeModalOpen(true)}>
              + Добавить доход
            </button>
            <button className="btn-primary" onClick={() => setExpenseModalOpen(true)}>
              + Добавить расход
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="hero-card text-white flex flex-col gap-5 rounded-2xl p-5 md:p-6 shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-sm font-medium opacity-80 mb-1">Доступно для трат</p>
              <div className="amount-large text-4xl md:text-5xl font-bold tracking-tight">
                {formatAmount(availableAfterSavings, currentBalance.baseCurrency)}
              </div>
              
              {availableBalance !== availableAfterSavings && (
                <p className="text-xs opacity-75 mt-1 font-medium">
                  До накоплений: {formatAmount(availableBalance, currentBalance.baseCurrency)}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20 relative z-10">
              <div>
                <div className="flex items-center gap-1.5 opacity-80 mb-1">
                  <Wallet size={14} />
                  <p className="text-xs font-medium">Всего на счетах</p>
                </div>
                <div className="font-bold text-lg leading-tight">
                  {formatAmount(currentBalance.total, currentBalance.baseCurrency)}
                </div>
                {Object.keys(currentBalance.byCurrency).length > 1 && (
                  <div className="text-[10px] opacity-70 mt-0.5 truncate">
                    {Object.entries(currentBalance.byCurrency)
                      .map(([code, amt]) => formatAmount(amt, code))
                      .join(' · ')}
                  </div>
                )}
              </div>
              
              <div>
                <div className="flex items-center gap-1.5 opacity-80 mb-1">
                  <CalendarDays size={14} />
                  <p className="text-xs font-medium">Лимит на день</p>
                </div>
                <div className="font-bold text-lg leading-tight">
                  ≈ {formatAmount(dailyLimit, currentBalance.baseCurrency)}
                </div>
              </div>
            </div>
          </div>

          {forecast && forecast.nextIncomeDate && forecast.expectedIncome > 0 && (
            <div className="card bg-emerald-50 border-emerald-100 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium text-emerald-800">Следующая зарплата</div>
                <div className="text-xs text-emerald-600 mt-1">
                  {toDisplayDate(forecast.nextIncomeDate, 'short')}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-700">+{formatAmount(forecast.expectedIncome, currentBalance.baseCurrency)}</div>
              </div>
            </div>
          )}

          {monthlyBudget > 0 && (
            <div className="card">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span>Расходы за месяц</span>
                <span>{formatAmount(monthlyExpenses, currentBalance.baseCurrency)} / {formatAmount(monthlyBudget, currentBalance.baseCurrency)}</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-bar-inner" 
                  style={{ 
                    width: `${Math.min(100, (monthlyExpenses / monthlyBudget) * 100)}%`,
                    backgroundColor: monthlyExpenses > monthlyBudget ? 'var(--color-expense)' : 'var(--color-primary)'
                  }} 
                />
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="card h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" hide />
                  <Tooltip 
                    formatter={(value: any, _name: any, props: any) => [
                      formatAmount(Number(value), currentBalance.baseCurrency),
                      props?.payload?.categoryNames || 'Расходы'
                    ]}
                    labelFormatter={(label: any) => toDisplayDate(String(label), 'short')}
                  />
                  <Bar dataKey="amount" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="Расходы" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {upcomingEvents.length > 0 && (
            <div>
              <h3 className="font-bold mb-3">Ближайшие события</h3>
              <div className="flex flex-col gap-2">
                {upcomingEvents.map((evt, i) => (
                  <div key={i} className={`notification-card ${evt.type === 'expense' ? 'border-amber-500' : 'border-emerald-500'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {evt.icon ? evt.icon : (evt.type === 'expense' ? '🏠' : '💰')}
                        </span>
                        <div>
                          <div className="font-medium text-sm">{evt.name}</div>
                          <div className="text-xs text-secondary">{toDisplayDate(evt.date, 'short')} • через {evt.daysUntil} дн.</div>
                        </div>
                      </div>
                      <div className={`font-bold ${evt.type === 'expense' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {evt.type === 'expense' ? '-' : '+'}{formatAmount(evt.amount, evt.currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentExpenses.length > 0 && (
            <div>
              <h3 className="font-bold mb-3">Последние расходы</h3>
              <div className="card flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {recentExpenses.map(exp => (
                  <div key={exp.id} className="py-3 first:pt-0 last:pb-0 flex justify-between items-center">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-lg border border-gray-100">
                        🏷️
                      </div>
                      <div>
                        <div className="font-medium text-sm">{exp.description || 'Без описания'}</div>
                        <div className="text-xs text-secondary">{toDisplayDate(exp.date, 'short')}</div>
                      </div>
                    </div>
                    <div className="font-medium text-expense">
                      -{formatAmount(exp.amount, exp.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <button className="fab hidden md:flex" onClick={() => setExpenseModalOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>

      <AddExpenseModal open={expenseModalOpen} onClose={() => setExpenseModalOpen(false)} onSaved={refresh} />
      <AddIncomeModal open={incomeModalOpen} onClose={() => setIncomeModalOpen(false)} onSaved={refresh} />
    </div>
  );
}
