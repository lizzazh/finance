import { useState, useEffect } from 'react';
import { AddExpenseModal } from '../../components/expenses/AddExpenseModal';
import { expensesRepo, categoriesRepo } from '../../db/repositories';
import { formatAmount } from '../../utils/format';
import { toDisplayDate } from '../../utils/date';
import type { Expense, Category, ExpenseStatus } from '../../types';
import { CheckCircle2, Pencil, Trash2, Plus, Filter } from 'lucide-react';

import { ConfirmModal } from '../../components/ui/ConfirmModal';

export default function Expenses() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Map<string, Category>>(new Map());
  const [statusFilter, setStatusFilter] = useState<'all' | ExpenseStatus>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    const exps = await expensesRepo.getAll();
    exps.sort((a, b) => b.date.localeCompare(a.date));
    setExpenses(exps);

    const cats = await categoriesRepo.getAll();
    const map = new Map<string, Category>();
    cats.forEach((c) => map.set(c.id, c));
    setCategories(map);
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmDelete() {
    if (deleteId) {
      await expensesRepo.delete(deleteId);
      setDeleteId(null);
      load();
    }
  }

  async function toggleStatus(expense: Expense) {
    const newStatus: ExpenseStatus = expense.status === 'completed' ? 'planned' : 'completed';
    await expensesRepo.update(expense.id, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    load();
  }

  function handleEdit(expense: Expense) {
    setEditingExpense(expense);
    setModalOpen(true);
  }

  function handleAddNew() {
    setEditingExpense(null);
    setModalOpen(true);
  }

  // Filtered expenses
  const filtered = expenses.filter((exp) => {
    if (statusFilter === 'all') return true;
    return exp.status === statusFilter;
  });

  // Group by date
  const grouped = filtered.reduce((acc, exp) => {
    if (!acc[exp.date]) acc[exp.date] = [];
    acc[exp.date].push(exp);
    return acc;
  }, {} as Record<string, Expense[]>);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <header className="sticky-header flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Расходы</h1>
          <p className="text-sm text-secondary">Управление разовыми и регулярными расходами</p>
        </div>
        <button className="btn-primary" onClick={handleAddNew}>
          <Plus size={18} />
          <span>Добавить</span>
        </button>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={16} className="text-secondary shrink-0" />
        <button
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === 'all' ? 'bg-primary text-white' : 'bg-surface text-secondary border border-border'}`}
          onClick={() => setStatusFilter('all')}
        >
          Все ({expenses.length})
        </button>
        <button
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-surface text-secondary border border-border'}`}
          onClick={() => setStatusFilter('completed')}
        >
          Оплаченные ({expenses.filter((e) => e.status === 'completed').length})
        </button>
        <button
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === 'planned' ? 'bg-amber-600 text-white' : 'bg-surface text-secondary border border-border'}`}
          onClick={() => setStatusFilter('planned')}
        >
          Запланированные ({expenses.filter((e) => e.status === 'planned').length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16 text-secondary">
          <span className="text-3xl block mb-2">💸</span>
          <p>Нет расходов по выбранному фильтру.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([date, exps]) => (
            <div key={date}>
              <h2 className="font-bold mb-3 text-secondary text-sm">{toDisplayDate(date, 'long')}</h2>
              <div className="card flex flex-col divide-y divide-border p-2">
                {exps.map((exp) => {
                  const cat = categories.get(exp.categoryId);
                  return (
                    <div key={exp.id} className="py-3 px-2 flex flex-col gap-2 group">
                      {/* Row 1: Icon + Name + Amount */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center text-xl shrink-0">
                          {cat?.icon || '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm">{cat?.name || 'Без категории'}</div>
                          {exp.description && <div className="text-xs text-secondary mt-0.5">{exp.description}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-expense text-base">
                            −{formatAmount(exp.amount, exp.currency)}
                          </div>
                          {exp.currency !== exp.baseCurrency && (
                            <div className="text-xs text-secondary">
                              ≈ {formatAmount(exp.baseAmount, exp.baseCurrency)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Status + Actions */}
                      <div className="flex items-center justify-between ml-13 pl-13" style={{marginLeft: '52px'}}>
                        <div>
                          {exp.status === 'planned' ? (
                            <span className="badge-planned text-[10px]">Запланировано</span>
                          ) : (
                            <span className="badge-completed text-[10px]">Оплачено</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            className={`p-1.5 rounded-lg border transition-all ${exp.status === 'completed' ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-border text-secondary hover:text-emerald-600'}`}
                            onClick={() => toggleStatus(exp)}
                            title={exp.status === 'completed' ? 'Отметить запланированным' : 'Отметить оплаченным'}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg border border-border text-secondary hover:text-primary hover:border-primary transition-all"
                            onClick={() => handleEdit(exp)}
                            title="Редактировать"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg border border-border text-secondary hover:text-red-600 hover:border-red-500 transition-all"
                            onClick={() => setDeleteId(exp.id)}
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab md:hidden" onClick={handleAddNew}>
        <Plus size={24} />
      </button>

      <AddExpenseModal
        open={modalOpen}
        initialExpense={editingExpense}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Удалить расход?"
        message="Вы уверены, что хотите удалить этот расход? Это действие нельзя отменить."
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
