import { useState, useEffect } from 'react';
import { recurringExpensesRepo, recurringIncomesRepo, expensesRepo } from '../../db/repositories';
import { formatAmount } from '../../utils/format';
import { toDisplayDate, today } from '../../utils/date';
import type { RecurringExpense, RecurringIncome, Expense } from '../../types';
import { AddExpenseModal } from '../../components/expenses/AddExpenseModal';
import { AddIncomeModal } from '../../components/incomes/AddIncomeModal';
import { CheckCircle2, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useSettings } from '../../hooks/useSettings';
import { currencyService } from '../../services/currency/currencyService';

export default function Recurring() {
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<Expense[]>([]);

  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addIncomeOpen, setAddIncomeOpen] = useState(false);

  const [deleteItem, setDeleteItem] = useState<{type: 'expense'|'income', id: string, name: string} | null>(null);
  const { settings } = useSettings();
  const baseCurrency = settings?.baseCurrency || 'UAH';
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});

  async function loadData() {
    const [recExp, recInc, planned] = await Promise.all([
      recurringExpensesRepo.getAll(),
      recurringIncomesRepo.getAll(),
      expensesRepo.getByStatus('planned'),
    ]);

    const uniqueCurrencies = Array.from(new Set([...recExp, ...recInc].map(item => item.currency)));
    const rates: Record<string, number> = {};
    const curDate = today();
    for (const c of uniqueCurrencies) {
      if (c !== baseCurrency) {
        rates[c] = await currencyService.getRate(c, baseCurrency, curDate);
      }
    }
    
    setRatesMap(rates);
    setRecurringExpenses(recExp);
    setRecurringIncomes(recInc);
    setPlannedExpenses(planned.sort((a, b) => a.date.localeCompare(b.date)));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleExpenseActive(item: RecurringExpense) {
    await recurringExpensesRepo.update(item.id, { active: !item.active });
    loadData();
  }

  async function toggleIncomeActive(item: RecurringIncome) {
    await recurringIncomesRepo.update(item.id, { active: !item.active });
    loadData();
  }

  async function deleteRecurringExpense(id: string) {
    await recurringExpensesRepo.delete(id);
    loadData();
  }

  async function deleteRecurringIncome(id: string) {
    await recurringIncomesRepo.delete(id);
    loadData();
  }

  async function markExpenseCompleted(expenseId: string) {
    await expensesRepo.update(expenseId, {
      status: 'completed',
      updatedAt: new Date().toISOString(),
    });
    loadData();
  }

  async function markExpensePlanned(expenseId: string) {
    await expensesRepo.update(expenseId, {
      status: 'planned',
      updatedAt: new Date().toISOString(),
    });
    loadData();
  }

  const FREQUENCY_LABELS: Record<string, string> = {
    monthly: 'Ежемесячно',
    weekly: 'Еженедельно',
    biweekly: 'Каждые 2 недели',
    every_4_weeks: 'Каждые 4 недели',
    yearly: 'Ежегодно',
    custom: 'Интервал',
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <header className="sticky-header flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Постоянные платежи</h1>
          <p className="text-sm text-secondary">Управление регулярными расходами и доходами</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm py-2 px-3" onClick={() => setAddIncomeOpen(true)}>
            + Доход
          </button>
          <button className="btn-primary text-sm py-2 px-3" onClick={() => setAddExpenseOpen(true)}>
            + Расход
          </button>
        </div>
      </header>

      {/* Planned Upcoming Expenses Section (planned -> completed UX) */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span>📋</span> Запланированные предстоящие платежи
        </h2>
        {plannedExpenses.length === 0 ? (
          <div className="card text-center py-6 text-secondary text-sm">
            Нет ближайших запланированных платежей
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {plannedExpenses.map((exp) => (
              <div key={exp.id} className="card flex items-center justify-between gap-4 p-4 border-l-4 border-amber-500">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{exp.description || 'Регулярный расход'}</div>
                  <div className="text-xs text-secondary mt-1">
                    Дата: <span className="font-medium text-text">{toDisplayDate(exp.date, 'long')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-expense">
                      −{formatAmount(exp.amount, exp.currency)}
                    </div>
                    {exp.currency !== baseCurrency && ratesMap[exp.currency] && (
                      <div className="text-xs text-secondary mt-0.5">
                        ≈ {formatAmount(currencyService.convert(exp.amount, ratesMap[exp.currency]), baseCurrency)}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-primary py-1.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => markExpenseCompleted(exp.id)}
                  >
                    <CheckCircle2 size={14} />
                    <span>Оплачен</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recurring Expenses Templates */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🏠</span> Шаблоны регулярных расходов
          </h2>
          <button className="btn-ghost text-xs text-primary font-medium" onClick={() => setAddExpenseOpen(true)}>
            <Plus size={14} /> Добавить шаблон
          </button>
        </div>
        {recurringExpenses.length === 0 ? (
          <div className="card text-center py-8 text-secondary text-sm">
            Нет шаблонов регулярных расходов. Создайте их в форме «Добавить расход» (тип: Регулярный).
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recurringExpenses.map((exp) => (
              <div key={exp.id} className={`card flex flex-col justify-between p-4 border border-border ${!exp.active ? 'opacity-60 bg-surface/50' : ''}`}>
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold text-base">{exp.name}</div>
                      <div className="text-xs text-primary font-medium mt-0.5">
                        {FREQUENCY_LABELS[exp.frequency] || exp.frequency}
                      </div>
                    </div>
                    <div className="font-bold text-expense text-base text-right shrink-0">
                      −{formatAmount(exp.amount, exp.currency)}
                      {exp.currency !== baseCurrency && ratesMap[exp.currency] && (
                        <div className="text-xs text-secondary mt-0.5 font-normal">
                          ≈ {formatAmount(currencyService.convert(exp.amount, ratesMap[exp.currency]), baseCurrency)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-secondary mt-3 flex flex-col gap-1 bg-surface p-2.5 rounded-xl border border-border">
                    <div className="flex justify-between">
                      <span>Старт повторений:</span>
                      <span className="font-medium text-text">
                        {toDisplayDate(exp.startDate || (exp.createdAt ? exp.createdAt.slice(0, 10) : exp.nextDate), 'short')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Повторять до:</span>
                      <span className="font-medium text-text">
                        {exp.endDate ? toDisplayDate(exp.endDate, 'short') : '♾️ Бессрочно'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exp.active}
                      onChange={() => toggleExpenseActive(exp)}
                      className="rounded border-border accent-primary w-4 h-4"
                    />
                    <span>{exp.active ? '🟢 Активен' : '⚪ На паузе'}</span>
                  </label>

                  <button
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium py-1 px-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                    onClick={() => setDeleteItem({ type: 'expense', id: exp.id, name: exp.name })}
                    title="Удалить этот регулярный шаблон"
                  >
                    <Trash2 size={14} />
                    <span>Удалить</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recurring Incomes Templates */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>💰</span> Шаблоны регулярных доходов
          </h2>
          <button className="btn-ghost text-xs text-primary font-medium" onClick={() => setAddIncomeOpen(true)}>
            <Plus size={14} /> Добавить шаблон
          </button>
        </div>
        {recurringIncomes.length === 0 ? (
          <div className="card text-center py-8 text-secondary text-sm">
            Нет шаблонов регулярных доходов. Создайте их в форме «Добавить доход» (тип: Регулярный).
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recurringIncomes.map((inc) => (
              <div key={inc.id} className={`card flex flex-col justify-between p-4 border border-border ${!inc.active ? 'opacity-60 bg-surface/50' : ''}`}>
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold text-base">{inc.name}</div>
                      <div className="text-xs text-emerald-600 font-medium mt-0.5">
                        {FREQUENCY_LABELS[inc.frequency] || inc.frequency}
                      </div>
                    </div>
                    <div className="font-bold text-income text-base text-right shrink-0">
                      +{formatAmount(inc.amount, inc.currency)}
                      {inc.currency !== baseCurrency && ratesMap[inc.currency] && (
                        <div className="text-xs text-secondary mt-0.5 font-normal">
                          ≈ {formatAmount(currencyService.convert(inc.amount, ratesMap[inc.currency]), baseCurrency)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-secondary mt-3 flex flex-col gap-1 bg-surface p-2.5 rounded-xl border border-border">
                    <div className="flex justify-between">
                      <span>Старт повторений:</span>
                      <span className="font-medium text-text">
                        {toDisplayDate(inc.startDate || (inc.createdAt ? inc.createdAt.slice(0, 10) : inc.nextDate), 'short')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Повторять до:</span>
                      <span className="font-medium text-text">
                        {inc.endDate ? toDisplayDate(inc.endDate, 'short') : '♾️ Бессрочно'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inc.active}
                      onChange={() => toggleIncomeActive(inc)}
                      className="rounded border-border accent-primary w-4 h-4"
                    />
                    <span>{inc.active ? '🟢 Активен' : '⚪ На паузе'}</span>
                  </label>

                  <button
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium py-1 px-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                    onClick={() => setDeleteItem({ type: 'income', id: inc.id, name: inc.name })}
                    title="Удалить этот регулярный шаблон"
                  >
                    <Trash2 size={14} />
                    <span>Удалить</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddExpenseModal open={addExpenseOpen} onClose={() => setAddExpenseOpen(false)} onSaved={loadData} />
      <AddIncomeModal open={addIncomeOpen} onClose={() => setAddIncomeOpen(false)} onSaved={loadData} />

      <ConfirmModal
        open={!!deleteItem}
        title={deleteItem?.type === 'expense' ? 'Удалить регулярный расход?' : 'Удалить регулярный доход?'}
        message={`Вы уверены, что хотите удалить шаблон "${deleteItem?.name}"? Действие нельзя отменить.`}
        onConfirm={() => {
          if (deleteItem?.type === 'expense') deleteRecurringExpense(deleteItem.id);
          if (deleteItem?.type === 'income') deleteRecurringIncome(deleteItem.id);
        }}
        onClose={() => setDeleteItem(null)}
      />
    </div>
  );
}
