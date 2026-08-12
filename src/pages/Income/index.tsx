import { useState, useEffect } from 'react';
import { AddIncomeModal } from '../../components/incomes/AddIncomeModal';
import { incomesRepo } from '../../db/repositories';
import { formatAmount } from '../../utils/format';
import { toDisplayDate, toDisplayMonth } from '../../utils/date';
import type { Income as IncomeType } from '../../types';
import { CheckCircle2, Pencil, Trash2, Plus, Filter } from 'lucide-react';

export default function Income() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeType | null>(null);
  const [incomes, setIncomes] = useState<IncomeType[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'received' | 'pending'>('all');

  async function load() {
    const data = await incomesRepo.getAll();
    data.sort((a, b) => b.date.localeCompare(a.date));
    setIncomes(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (window.confirm('Удалить этот доход?')) {
      await incomesRepo.delete(id);
      load();
    }
  }

  async function toggleStatus(income: IncomeType) {
    const newStatus = (income.status || 'received') === 'received' ? 'pending' : 'received';
    await incomesRepo.update(income.id, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    load();
  }

  function handleEdit(income: IncomeType) {
    setEditingIncome(income);
    setModalOpen(true);
  }

  function handleAddNew() {
    setEditingIncome(null);
    setModalOpen(true);
  }

  // Filtered incomes
  const filtered = incomes.filter((inc) => {
    if (statusFilter === 'all') return true;
    const st = inc.status || 'received';
    return st === statusFilter;
  });

  const grouped = filtered.reduce((acc, inc) => {
    const month = inc.date.substring(0, 7) + '-01';
    if (!acc[month]) acc[month] = [];
    acc[month].push(inc);
    return acc;
  }, {} as Record<string, IncomeType[]>);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Доходы</h1>
          <p className="text-sm text-secondary">Управление поступившими и ожидаемыми доходами</p>
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
          Все ({incomes.length})
        </button>
        <button
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === 'received' ? 'bg-emerald-600 text-white' : 'bg-surface text-secondary border border-border'}`}
          onClick={() => setStatusFilter('received')}
        >
          Пришли / Полученные ({incomes.filter((i) => (i.status || 'received') === 'received').length})
        </button>
        <button
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-surface text-secondary border border-border'}`}
          onClick={() => setStatusFilter('pending')}
        >
          Ожидаются ({incomes.filter((i) => i.status === 'pending').length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16 text-secondary">
          <span className="text-3xl block mb-2">💰</span>
          <p>Нет доходов по выбранному фильтру.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped)
            .sort()
            .reverse()
            .map(([month, incs]) => (
              <div key={month}>
                <h2 className="font-bold mb-3 text-secondary capitalize text-sm">{toDisplayMonth(month)}</h2>
                <div className="card flex flex-col divide-y divide-border p-2">
                  {incs.map((inc) => {
                    const st = inc.status || 'received';
                    return (
                      <div key={inc.id} className="py-3 px-2 flex items-center justify-between gap-3 group">
                        <div className="flex gap-3 items-center min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                            💰
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm truncate">{inc.name}</div>
                            <div className="text-xs text-secondary truncate">{toDisplayDate(inc.date, 'short')}</div>
                            {inc.savingsApplied && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded mt-1 inline-block">
                                Отложено
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-bold text-income text-base">
                              +{formatAmount(inc.amount, inc.currency)}
                            </div>
                            {inc.currency !== inc.baseCurrency && (
                              <div className="text-xs text-secondary">
                                ≈ {formatAmount(inc.baseAmount, inc.baseCurrency)}
                              </div>
                            )}
                            <div className="mt-0.5">
                              {st === 'pending' ? (
                                <span className="badge-planned text-[10px]">⏳ Ожидается</span>
                              ) : (
                                <span className="badge-completed text-[10px]">✓ Получен</span>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              className={`p-1.5 rounded-lg border transition-all ${st === 'received' ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-border text-secondary hover:text-emerald-600'}`}
                              onClick={() => toggleStatus(inc)}
                              title={st === 'received' ? 'Отметить как ожидается' : 'Отметить как получен'}
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              className="p-1.5 rounded-lg border border-border text-secondary hover:text-primary hover:border-primary transition-all"
                              onClick={() => handleEdit(inc)}
                              title="Редактировать"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="p-1.5 rounded-lg border border-border text-secondary hover:text-red-600 hover:border-red-500 transition-all"
                              onClick={() => handleDelete(inc.id)}
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

      <AddIncomeModal
        open={modalOpen}
        initialIncome={editingIncome}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
