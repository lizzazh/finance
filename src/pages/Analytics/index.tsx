import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { analyticsService } from '../../services/analytics';
import type { DailyExpense, CategoryBreakdown, MonthlyComparison } from '../../types';
import { startOfMonth, endOfMonth, today } from '../../utils/date';
import { db } from '../../db/database';

type Period = 'month' | '3months' | '6months' | 'year';

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Месяц',
  '3months': '3 месяца',
  '6months': '6 месяцев',
  year: 'Год',
};

const CHART_COLORS = [
  '#5c7a29', '#3a7ca5', '#d97706', '#c0392b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('ru-RU') : p.value} ₴
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const [period, setPeriod] = useState<Period>('month');
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpense[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [monthly, setMonthly] = useState<MonthlyComparison[]>([]);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, savings: 0, avg: 0 });
  const [baseCurrency, setBaseCurrency] = useState('UAH');
  const [loading, setLoading] = useState(true);

  const getDateRange = useCallback((): [string, string] => {
    const t = today();
    const monthStart = startOfMonth(t);
    const monthEnd = endOfMonth(t);
    if (period === 'month') return [monthStart, monthEnd];
    const months = period === '3months' ? 3 : period === '6months' ? 6 : 12;
    const start = new Date();
    start.setMonth(start.getMonth() - months + 1);
    start.setDate(1);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    return [startStr, monthEnd];
  }, [period]);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    const [from, to] = getDateRange();

    const bc = ((await db.settings.get('baseCurrency'))?.value as string) || 'UAH';
    setBaseCurrency(bc);

    const months = period === 'month' ? 1 : period === '3months' ? 3 : period === '6months' ? 6 : 12;

    const [daily, cats, mon, totalInc, totalExp, totalSav, avgDay] = await Promise.all([
      analyticsService.getDailyExpenses(from, to),
      analyticsService.getCategoryBreakdown(from, to),
      analyticsService.getMonthlyComparison(months),
      analyticsService.getTotalIncome(from, to),
      analyticsService.getTotalExpenses(from, to),
      analyticsService.getTotalSavings(from, to),
      analyticsService.getAverageDailySpend(from, to),
    ]);

    setDailyExpenses(daily);
    setCategories(cats.slice(0, 8));
    setMonthly(mon);
    setTotals({ income: totalInc, expenses: totalExp, savings: totalSav, avg: avgDay });
    setLoading(false);
  }

  const currencySymbol = baseCurrency === 'UAH' ? '₴' : baseCurrency;

  return (
    <div className="page-container">
      <div className="sticky-header">
        <h1 className="page-title">Аналитика</h1>
        <div className="period-tabs">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              className={`period-tab ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="skeleton-list">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="analytics-summary">
            <div className="card analytics-stat">
              <div className="analytics-stat-label">Доходы</div>
              <div className="analytics-stat-value positive">+{totals.income.toLocaleString('ru-RU')} {currencySymbol}</div>
            </div>
            <div className="card analytics-stat">
              <div className="analytics-stat-label">Расходы</div>
              <div className="analytics-stat-value negative">−{totals.expenses.toLocaleString('ru-RU')} {currencySymbol}</div>
            </div>
            <div className="card analytics-stat">
              <div className="analytics-stat-label">Накопления</div>
              <div className="analytics-stat-value savings">{totals.savings.toLocaleString('ru-RU')} {currencySymbol}</div>
            </div>
            <div className="card analytics-stat">
              <div className="analytics-stat-label">В день (среднее)</div>
              <div className="analytics-stat-value">{totals.avg.toLocaleString('ru-RU')} {currencySymbol}</div>
            </div>
          </div>

          {/* Daily Expenses Chart */}
          {dailyExpenses.length > 0 && (
            <div className="card chart-card">
              <h2 className="chart-title">Расходы по дням</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyExpenses} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v.slice(8)} // day number
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="Расходы" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Monthly Comparison */}
          {monthly.length > 1 && (
            <div className="card chart-card">
              <h2 className="chart-title">Доходы и расходы по месяцам</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => {
                      const [, m] = v.split('-');
                      const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
                      return months[parseInt(m) - 1];
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} />
                  <Line type="monotone" dataKey="income" stroke="var(--color-income)" strokeWidth={2} dot={false} name="Доходы" />
                  <Line type="monotone" dataKey="expenses" stroke="var(--color-expense)" strokeWidth={2} dot={false} name="Расходы" />
                  <Line type="monotone" dataKey="savings" stroke="var(--color-savings)" strokeWidth={2} dot={false} name="Накопления" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category Breakdown */}
          {categories.length > 0 && (
            <div className="card chart-card">
              <h2 className="chart-title">По категориям</h2>
              <div className="category-breakdown">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="amount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                    >
                      {categories.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${Number(value).toLocaleString('ru-RU')} ${currencySymbol}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="category-legend">
                  {categories.map((cat, idx) => (
                    <div key={cat.categoryId} className="category-legend-item">
                      <span
                        className="category-legend-dot"
                        style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="category-legend-icon">{cat.categoryIcon}</span>
                      <span className="category-legend-name">{cat.categoryName}</span>
                      <span className="category-legend-pct">{cat.percentage.toFixed(0)}%</span>
                      <span className="category-legend-amount">
                        {cat.amount.toLocaleString('ru-RU')} {currencySymbol}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
