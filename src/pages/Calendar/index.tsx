import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, PlusCircle, ArrowDownRight, ArrowUpRight, Clock, Pencil, Trash2 } from 'lucide-react';
import { db } from '../../db/database';
import { expensesRepo, incomesRepo, recurringExpensesRepo, recurringIncomesRepo } from '../../db/repositories';
import { toDisplayDate, toDisplayMonth, startOfMonth, endOfMonth, today, getNextRecurringDate } from '../../utils/date';
import { formatAmount } from '../../utils/format';
import { AddExpenseModal } from '../../components/expenses/AddExpenseModal';
import { AddIncomeModal } from '../../components/incomes/AddIncomeModal';
import type { Expense, Income, SavingsTransaction } from '../../types';

interface CalendarEvent {
  id: string;
  sourceType: 'expense' | 'income' | 'savings';
  date: string;
  type: 'income' | 'expense' | 'planned' | 'savings';
  name: string;
  amount: number;
  currency: string;
  icon: string;
  rawExpense?: Expense;
  rawIncome?: Income;
  rawSavings?: any; // any to avoid importing SavingsTransaction if not needed, wait, let's use SavingsTransaction
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => today().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingSavings, setEditingSavings] = useState<SavingsTransaction | null>(null);

  const monthStart = startOfMonth(currentMonth + '-01');
  const monthEnd = endOfMonth(currentMonth + '-01');

  useEffect(() => {
    loadEvents();
  }, [currentMonth]);

  async function loadEvents() {
    setLoading(true);
    const [expenses, incomes, recurringIncomes, recurringExpenses, categories, savings] = await Promise.all([
      expensesRepo.getByDateRange(monthStart, monthEnd),
      incomesRepo.getByDateRange(monthStart, monthEnd),
      recurringIncomesRepo.getAll(),
      recurringExpensesRepo.getAll(),
      db.categories.toArray(),
      db.savingsTransactions.where('date').between(monthStart, monthEnd, true, true).toArray(),
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const evMap: Record<string, CalendarEvent[]> = {};

    function addEv(d: string, ev: CalendarEvent) {
      if (!evMap[d]) evMap[d] = [];
      evMap[d].push(ev);
    }

    // 1. Database actual and planned expenses
    for (const exp of expenses) {
      if (exp.status === 'cancelled') continue;
      const cat = catMap.get(exp.categoryId);
      addEv(exp.date, {
        id: exp.id,
        sourceType: 'expense',
        date: exp.date,
        type: exp.status === 'planned' ? 'planned' : 'expense',
        name: exp.description || cat?.name || 'Расход',
        amount: exp.amount,
        currency: exp.currency,
        icon: cat?.icon || '📦',
        rawExpense: exp,
      });
    }

    // 2. Database actual incomes
    for (const inc of incomes) {
      addEv(inc.date, {
        id: inc.id,
        sourceType: 'income',
        date: inc.date,
        type: 'income',
        name: inc.name,
        amount: inc.amount,
        currency: inc.currency,
        icon: '💰',
        rawIncome: inc,
      });
    }

    // 2.5 Database Savings
    for (const sav of savings) {
      addEv(sav.date, {
        id: sav.id,
        sourceType: 'savings',
        date: sav.date,
        type: 'savings',
        name: 'Накопление',
        amount: sav.amount,
        currency: sav.currency,
        icon: '🐷',
        rawSavings: sav,
      });
    }

    // 3. Project recurring expenses into this visible month
    for (const re of recurringExpenses) {
      const cat = catMap.get(re.categoryId);
      const dayNum = re.dayOfMonth || (re.startDate ? parseInt(re.startDate.slice(8, 10)) : undefined);
      let cur = re.startDate || (re.createdAt ? re.createdAt.slice(0, 10) : re.nextDate);

      // Fast forward cur until monthStart
      let safety = 0;
      while (cur < monthStart && safety < 120) {
        const next = getNextRecurringDate(cur, re.frequency, dayNum, re.customIntervalDays);
        if (next <= cur) break;
        cur = next;
        safety++;
      }

      // Add occurrences in this month
      safety = 0;
      while (cur >= monthStart && cur <= monthEnd && safety < 100) {
        if (re.endDate && cur > re.endDate) break;

        const alreadyExists = (evMap[cur] || []).some(
          (e) => e.rawExpense?.recurringExpenseId === re.id
        );
        if (!alreadyExists) {
          addEv(cur, {
            id: `rec_exp_${re.id}_${cur}`,
            sourceType: 'expense',
            date: cur,
            type: 'planned',
            name: `${re.name} (регулярный)`,
            amount: re.amount,
            currency: re.currency,
            icon: cat?.icon || '📋',
          });
        }

        const next = getNextRecurringDate(cur, re.frequency, dayNum, re.customIntervalDays);
        if (next <= cur) break;
        cur = next;
        safety++;
      }
    }

    // 4. Project recurring incomes into this visible month
    for (const ri of recurringIncomes) {
      const dayNum = ri.dayOfMonth || (ri.startDate ? parseInt(ri.startDate.slice(8, 10)) : undefined);
      let cur = ri.startDate || (ri.createdAt ? ri.createdAt.slice(0, 10) : ri.nextDate);

      // Fast forward cur until monthStart
      let safety = 0;
      while (cur < monthStart && safety < 120) {
        const next = getNextRecurringDate(cur, ri.frequency, dayNum, ri.customIntervalDays);
        if (next <= cur) break;
        cur = next;
        safety++;
      }

      // Add occurrences in this month
      safety = 0;
      while (cur >= monthStart && cur <= monthEnd && safety < 100) {
        if (ri.endDate && cur > ri.endDate) break;

        const alreadyExists = (evMap[cur] || []).some(
          (e) => e.rawIncome?.recurringIncomeId === ri.id
        );
        if (!alreadyExists) {
          addEv(cur, {
            id: `rec_inc_${ri.id}_${cur}`,
            sourceType: 'income',
            date: cur,
            type: 'income',
            name: `${ri.name} (ожидается)`,
            amount: ri.amount,
            currency: ri.currency,
            icon: '🗓',
          });
        }

        const next = getNextRecurringDate(cur, ri.frequency, dayNum, ri.customIntervalDays);
        if (next <= cur) break;
        cur = next;
        safety++;
      }
    }

    setEvents(evMap);
    setLoading(false);
  }

  function prevMonth() {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const newM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newM);
    setSelectedDate(newM + '-01');
  }

  function nextMonth() {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const newM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newM);
    setSelectedDate(newM + '-01');
  }

  async function handleDeleteEvent(ev: CalendarEvent) {
    if (ev.sourceType === 'expense' && ev.rawExpense) {
      if (window.confirm('Удалить этот расход?')) {
        await expensesRepo.delete(ev.rawExpense.id);
        loadEvents();
      }
    } else if (ev.sourceType === 'income' && ev.rawIncome) {
      if (window.confirm('Удалить этот доход?')) {
        await incomesRepo.delete(ev.rawIncome.id);
        loadEvents();
      }
    } else if (ev.sourceType === 'savings' && ev.rawSavings) {
      if (window.confirm('Удалить это накопление?')) {
        await db.savingsTransactions.delete(ev.rawSavings.id);
        loadEvents();
      }
    }
  }

  function handleEditEvent(ev: CalendarEvent) {
    if (ev.sourceType === 'expense' && ev.rawExpense) {
      setEditingExpense(ev.rawExpense);
      setEditingSavings(null);
      setExpenseModalOpen(true);
    } else if (ev.sourceType === 'income' && ev.rawIncome) {
      setEditingIncome(ev.rawIncome);
      setIncomeModalOpen(true);
    } else if (ev.sourceType === 'savings' && ev.rawSavings) {
      setEditingSavings(ev.rawSavings);
      setEditingExpense(null);
      setExpenseModalOpen(true);
    }
  }

  function handleAddExpenseForDate() {
    setEditingExpense(null);
    setEditingSavings(null);
    setExpenseModalOpen(true);
  }

  function handleAddIncomeForDate() {
    setEditingIncome(null);
    setIncomeModalOpen(true);
  }

  // Build calendar grid cells
  const [year, month] = currentMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Mon=0
  const totalDays = lastDay.getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  function handleCloseExpenseModal() {
    setEditingExpense(null);
    setEditingSavings(null);
    setExpenseModalOpen(false);
  }

  function handleCloseIncomeModal() {
    setEditingIncome(null);
    setIncomeModalOpen(false);
  }

  function handleExpenseSaved() {
    setEditingExpense(null);
    setEditingSavings(null);
    loadEvents();
  }

  function handleIncomeSaved() {
    setEditingIncome(null);
    loadEvents();
  }

  const selectedEvents = events[selectedDate] || [];

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <header className="sticky-header flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Календарь</h1>
          <p className="text-sm text-secondary">Обзор доходов и расходов по дням</p>
        </div>
        <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-border">
          <button className="btn-ghost p-1.5" onClick={prevMonth} aria-label="Предыдущий месяц">
            <ChevronLeft size={20} />
          </button>
          <span className="font-bold text-sm px-2 capitalize">
            {toDisplayMonth(currentMonth + '-01')}
          </span>
          <button className="btn-ghost p-1.5" onClick={nextMonth} aria-label="Следующий месяц">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Main Calendar Card */}
      <div className="card p-4 flex flex-col gap-3">
        {/* Weekday Labels */}
        <div className="calendar-weekdays">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
            <div key={d} className="text-center text-xs font-bold text-secondary">
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="calendar-grid">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="calendar-cell empty" />;
            const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
            const dayEvs = events[dateStr] || [];
            const isToday = dateStr === today();
            const isSelected = dateStr === selectedDate;

            const incTotal = dayEvs.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
            const expTotal = dayEvs.filter((e) => e.type === 'expense' || e.type === 'planned').reduce((sum, e) => sum + e.amount, 0);
            const hasCompleted = dayEvs.some((e) => e.type === 'expense');
            const hasPlanned = dayEvs.some((e) => e.type === 'planned');

            return (
              <div
                key={dateStr}
                className={`calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedDate(dateStr)}
              >
                <div className="flex justify-between items-start">
                  <span className={`calendar-day-num ${isToday ? 'text-primary font-bold' : ''}`}>{day}</span>
                  {dayEvs.length > 0 && (
                    <div className="calendar-dots">
                      {incTotal > 0 && <span className="dot dot-income" />}
                      {hasCompleted && <span className="dot" style={{background:'#3b82f6'}} />}
                      {hasPlanned && <span className="dot dot-expense" />}
                    </div>
                  )}
                </div>

                {/* Micro amounts preview inside cell */}
                <div className="flex flex-col gap-0.5 mt-1 overflow-hidden text-[10px]">
                  {incTotal > 0 && (
                    <span className="text-emerald-600 font-medium truncate">+{Math.round(incTotal)}</span>
                  )}
                  {expTotal > 0 && (
                    <span className="text-red-500 font-medium truncate">−{Math.round(expTotal)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Panel */}
      <div className="card p-4 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="text-xs text-secondary font-medium">События на выбранный день:</div>
            <div className="text-lg font-bold">{toDisplayDate(selectedDate, 'long')}</div>
          </div>

          {/* Quick Create Buttons for Selected Date */}
          <div className="flex items-center gap-2">
            <button
              className="btn-primary text-xs py-2 px-3 flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleAddExpenseForDate}
            >
              <ArrowDownRight size={15} />
              <span>+ Расход</span>
            </button>
            <button
              className="btn-primary text-xs py-2 px-3 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleAddIncomeForDate}
            >
              <ArrowUpRight size={15} />
              <span>+ Доход</span>
            </button>
          </div>
        </div>

        {/* Selected Day Events List */}
        {loading ? (
          <div className="py-6 text-center text-secondary text-sm">Загрузка...</div>
        ) : selectedEvents.length === 0 ? (
          <div className="text-center py-8 text-secondary flex flex-col items-center gap-2">
            <span className="text-2xl">📅</span>
            <p className="text-sm">Нет записей на этот день. Используйте кнопки выше, чтобы добавить расход или доход.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {selectedEvents.map((ev, i) => (
              <div key={i} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${ev.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : ev.type === 'planned' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40' : 'bg-red-50 text-red-600 dark:bg-red-950/40'}`}>
                    {ev.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{ev.name}</div>
                    <div className="text-xs text-secondary flex items-center gap-1">
                      {ev.type === 'planned' && <Clock size={12} className="text-amber-500" />}
                      <span>{ev.type === 'income' ? 'Доход' : ev.type === 'planned' ? 'Запланировано' : 'Оплачено'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className={`font-bold text-base ${ev.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {ev.type === 'income' ? '+' : '−'}{formatAmount(ev.amount, ev.currency)}
                  </div>

                  {(ev.rawExpense || ev.rawIncome) && (
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 rounded-lg border border-border text-secondary hover:text-primary transition-all"
                        onClick={() => handleEditEvent(ev)}
                        title="Редактировать"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="p-1.5 rounded-lg border border-border text-secondary hover:text-red-600 transition-all"
                        onClick={() => handleDeleteEvent(ev)}
                        title="Удалить"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modals pre-filled with selectedDate */}
      <AddExpenseModal
        open={expenseModalOpen}
        initialExpense={editingExpense}
        initialSavings={editingSavings}
        initialDate={selectedDate}
        onClose={handleCloseExpenseModal}
        onSaved={handleExpenseSaved}
      />
      <AddIncomeModal
        open={incomeModalOpen}
        initialIncome={editingIncome}
        initialDate={selectedDate}
        onClose={handleCloseIncomeModal}
        onSaved={handleIncomeSaved}
      />
    </div>
  );
}
