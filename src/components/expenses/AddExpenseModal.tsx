import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { AmountInput } from '../ui/AmountInput';
import { expensesRepo, recurringExpensesRepo, categoriesRepo, incomesRepo, recurringIncomesRepo } from '../../db/repositories';
import { db } from '../../db/database';
import { currencyService } from '../../services/currency/currencyService';
import { generateId } from '../../utils/id';
import { today, getNextRecurringDate } from '../../utils/date';
import { useSettings } from '../../hooks/useSettings';
import { recurringExpensesService } from '../../services/recurringExpenses';
import { CustomReminderPicker, parseReminderOffset, formatReminderConfig } from '../ui/CustomReminderPicker';
import type { Category, CurrencyCode, ExpenseStatus, IncomeFrequency, Expense, ReminderOffset, SavingsTransaction } from '../../types';
import { formatAmount } from '../../utils/format';

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialExpense?: Expense | null;
  initialSavings?: SavingsTransaction | null;
  initialDate?: string;
}

export function AddExpenseModal({ open, onClose, onSaved, initialExpense, initialSavings, initialDate }: AddExpenseModalProps) {
  const { settings } = useSettings();
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('UAH');
  const [date, setDate] = useState(today());
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [convertedAmount, setConvertedAmount] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [recordType, setRecordType] = useState<'expense' | 'savings'>('expense');

  // Single vs Recurring
  const [expenseType, setExpenseType] = useState<'single' | 'recurring'>('single');
  const [frequency, setFrequency] = useState<IncomeFrequency>('monthly');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('completed');
  const [reminderOffset, setReminderOffset] = useState<ReminderOffset>('1_day');

  // Amount Mode: Fixed vs Percentage of Income
  const [amountMode, setAmountMode] = useState<'fixed' | 'percentage_of_income'>('fixed');
  const [percentageValueStr, setPercentageValueStr] = useState('10');
  const [selectedIncomeId, setSelectedIncomeId] = useState<string>('salary');
  const [availableIncomes, setAvailableIncomes] = useState<Array<{ id: string; name: string; amount: number; currency: string }>>([]);

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatEmoji, setNewCatEmoji] = useState('📌');
  const [newCatName, setNewCatName] = useState('');
  const [customIntervalDays, setCustomIntervalDays] = useState(30);

  const baseCurrency = settings?.baseCurrency || 'UAH';

  const isEditing = !!initialExpense || !!initialSavings;

  useEffect(() => {
    if (open) {
      document.body.classList.add('modal-open');

      if (initialSavings) {
        setRecordType('savings');
        setAmountStr(initialSavings.amount.toString());
        setCurrency(initialSavings.currency);
        setDate(initialSavings.date);
        
        if (initialSavings.ruleType === 'percentage') {
          setAmountMode('percentage_of_income');
          setPercentageValueStr(initialSavings.ruleValue.toString());
          if (initialSavings.incomeId !== 'manual') {
            setSelectedIncomeId(initialSavings.incomeId);
          }
        } else {
          setAmountMode('fixed');
        }
      } else if (initialExpense) {
        setRecordType('expense');
        setAmountStr(initialExpense.amount.toString());
        setCurrency(initialExpense.currency);
        setDate(initialExpense.date);
        setCategoryId(initialExpense.categoryId);
        setDescription(initialExpense.description || '');
        setStatus(initialExpense.status);
        setReminderOffset(initialExpense.reminderOffset || '1_day');
        setAmountMode(initialExpense.amountMode || 'fixed');
        if (initialExpense.percentageValue) {
          setPercentageValueStr(String(initialExpense.percentageValue));
        }
        if (initialExpense.percentageIncomeId) {
          setSelectedIncomeId(initialExpense.percentageIncomeId);
        }
        setExpenseType(initialExpense.recurringExpenseId ? 'recurring' : 'single');
      } else {
        setAmountStr('');
        const curDate = initialDate || today();
        setDate(curDate);
        setDescription('');
        setIsSubmitting(false);
        setExpenseType('single');
        setRecordType('expense');
        setFrequency('monthly');
        setStatus(curDate <= today() ? 'completed' : 'planned');
        setReminderOffset('1_day');
        setAmountMode('fixed');
        setPercentageValueStr('10');
        setSelectedIncomeId('salary');
        setCurrency(settings?.baseCurrency || 'UAH');
      }

      // Load categories
      categoriesRepo.getByType('expense').then((cats) => {
        setCategories(cats);
        const lastUsed = localStorage.getItem('lastUsedExpenseCategory');
        if (lastUsed && cats.some((c) => c.id === lastUsed)) {
          setCategoryId(lastUsed);
        } else if (cats.length > 0) {
          setCategoryId(cats[0].id);
        }
      });

      // Load available incomes for percentage calculation
      Promise.all([incomesRepo.getAll(), recurringIncomesRepo.getAll()]).then(([incList, recList]) => {
        const list: Array<{ id: string; name: string; amount: number; currency: string }> = [];

        for (const r of recList) {
          list.push({ id: `rec_${r.id}`, name: `${r.name} (чистый)`, amount: r.amount, currency: r.currency });
        }
        for (const i of incList.slice(0, 10)) {
          list.push({ id: `inc_${i.id}`, name: `${i.name} (${toDisplayDateShort(i.date)})`, amount: i.amount, currency: i.currency });
        }

        setAvailableIncomes(list);
        if (list.length > 0) {
          setSelectedIncomeId(list[0].id);
        }
      });
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open, settings, initialExpense, initialSavings, initialDate]);

  function toDisplayDateShort(d: string): string {
    const [, m, day] = d.split('-');
    return `${day}.${m}`;
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const id = generateId();
    const newCat: Category = {
      id,
      name: newCatName.trim(),
      icon: newCatEmoji || '📌',
      type: 'expense',
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    await categoriesRepo.add(newCat);
    setCategories(prev => [...prev, newCat]);
    setCategoryId(id);
    setNewCatName('');
    setNewCatEmoji('📌');
    setShowNewCategory(false);
  }

  // Update calculation when in percentage mode
  useEffect(() => {
    if (amountMode === 'percentage_of_income') {
      const pct = parseFloat(percentageValueStr) || 0;
      let targetIncome = availableIncomes.find((i) => i.id === selectedIncomeId);
      if (!targetIncome && availableIncomes.length > 0) {
        targetIncome = availableIncomes[0];
      }

      if (targetIncome && pct > 0) {
        const calc = Math.round((targetIncome.amount * (pct / 100)) * 100) / 100;
        setAmountStr(String(calc));
        setCurrency(targetIncome.currency);
      }
    }
  }, [amountMode, percentageValueStr, selectedIncomeId, availableIncomes]);

  useEffect(() => {
    setStatus(date <= today() ? 'completed' : 'planned');
  }, [date]);

  useEffect(() => {
    const amt = parseFloat(amountStr) || 0;
    if (amt > 0 && currency !== baseCurrency) {
      currencyService
        .getRate(currency, baseCurrency, date)
        .then((rate) => setConvertedAmount(currencyService.convert(amt, rate)))
        .catch(() => setConvertedAmount(undefined));
    } else {
      setConvertedAmount(undefined);
    }
  }, [amountStr, currency, baseCurrency, date]);

  if (!open) return null;

  async function handleSave() {
    const amount = parseFloat(amountStr);
    
    // Validate amount
    if (!amount || amount <= 0 || isSubmitting) return;

    if (recordType === 'expense' && !categoryId) return;

    try {
      setIsSubmitting(true);
      const snapshot = await currencyService.buildSnapshot(amount, currency, baseCurrency, date);
      const now = new Date().toISOString();

      if (recordType === 'savings') {
        if (expenseType === 'single') {
          if (isEditing && initialSavings) {
            await db.savingsTransactions.update(initialSavings.id, {
              amount,
              currency,
              exchangeRate: snapshot.exchangeRate,
              baseAmount: snapshot.baseAmount,
              baseCurrency: snapshot.baseCurrency,
              date,
              ruleType: amountMode === 'percentage_of_income' ? 'percentage' : 'fixed',
              ruleValue: amountMode === 'percentage_of_income' ? parseFloat(percentageValueStr) : amount,
              incomeId: amountMode === 'percentage_of_income' ? selectedIncomeId : 'manual',
            });
          } else {
            // Save as single savings transaction
            await db.savingsTransactions.add({
              id: generateId(),
              incomeId: amountMode === 'percentage_of_income' ? selectedIncomeId : 'manual',
              amount,
              currency,
              exchangeRate: snapshot.exchangeRate,
              baseAmount: snapshot.baseAmount,
              baseCurrency: snapshot.baseCurrency,
              ruleId: 'manual',
              ruleType: amountMode === 'percentage_of_income' ? 'percentage' : 'fixed',
              ruleValue: amountMode === 'percentage_of_income' ? parseFloat(percentageValueStr) : amount,
              date,
              createdAt: now
            });
          }
          
          onSaved?.();
          onClose();
          return;
        } else {
          // It's a recurring saving! We will save it in recurringExpenses with a special category __savings__
          // Fall through to the recurring logic below, but override categoryId.
        }
      }

      let recurringExpenseId: string | undefined = initialExpense?.recurringExpenseId;
      const actualCategoryId = recordType === 'savings' ? '__savings__' : categoryId;

      if (expenseType === 'recurring') {
        const startDayOfMonth = parseInt(date.slice(8, 10)) || undefined;
        const computedNextDate = getNextRecurringDate(date, frequency, startDayOfMonth);

        if (recurringExpenseId) {
          await recurringExpensesRepo.update(recurringExpenseId, {
            name: recordType === 'savings' ? 'Регулярное накопление' : description.trim() || categories.find((c) => c.id === actualCategoryId)?.name || 'Постоянный расход',
            amount,
            currency,
            categoryId: actualCategoryId,
            frequency,
            dayOfMonth: frequency === 'monthly' ? startDayOfMonth : undefined,
            customIntervalDays: frequency === 'custom' ? customIntervalDays : undefined,
            amountMode,
            percentageIncomeId: amountMode === 'percentage_of_income' ? selectedIncomeId : undefined,
            percentageValue: amountMode === 'percentage_of_income' ? parseFloat(percentageValueStr) : undefined,
            startDate: date,
            nextDate: computedNextDate,
            endDate: hasEndDate && endDate ? endDate : undefined,
            active: true,
            reminderOffset,
            updatedAt: now,
          });

          // Update all PLANNED expenses linked to this recurring template
          const existingExpenses = await db.expenses.where('recurringExpenseId').equals(recurringExpenseId).toArray();
          for (const exp of existingExpenses) {
            if (exp.status === 'planned') {
              const expSnapshot = await currencyService.buildSnapshot(amount, currency, baseCurrency, exp.date);
              await expensesRepo.update(exp.id, {
                amount,
                currency,
                exchangeRate: expSnapshot.exchangeRate,
                baseAmount: expSnapshot.baseAmount,
                baseCurrency: expSnapshot.baseCurrency,
                categoryId,
                description: description.trim() || categories.find((c) => c.id === categoryId)?.name || 'Постоянный расход',
                amountMode,
                percentageIncomeId: amountMode === 'percentage_of_income' ? selectedIncomeId : undefined,
                percentageValue: amountMode === 'percentage_of_income' ? parseFloat(percentageValueStr) : undefined,
                reminderOffset,
                updatedAt: now,
              });
            }
          }
        } else {
          recurringExpenseId = generateId();
          await recurringExpensesRepo.add({
            id: recurringExpenseId,
            name: recordType === 'savings' ? 'Регулярное накопление' : description.trim() || categories.find((c) => c.id === actualCategoryId)?.name || 'Постоянный расход',
            amount,
            currency,
            categoryId: actualCategoryId,
            frequency,
            dayOfMonth: frequency === 'monthly' ? startDayOfMonth : undefined,
            customIntervalDays: frequency === 'custom' ? customIntervalDays : undefined,
            amountMode,
            percentageIncomeId: amountMode === 'percentage_of_income' ? selectedIncomeId : undefined,
            percentageValue: amountMode === 'percentage_of_income' ? parseFloat(percentageValueStr) : undefined,
            startDate: date,
            nextDate: computedNextDate,
            endDate: hasEndDate && endDate ? endDate : undefined,
            active: true,
            reminderOffset,
            createdAt: now,
            updatedAt: now,
          });
        }
        await recurringExpensesService.processSingle(recurringExpenseId);
      }

      if (isEditing && initialExpense) {
        await expensesRepo.update(initialExpense.id, {
          amount,
          currency,
          exchangeRate: snapshot.exchangeRate,
          baseAmount: snapshot.baseAmount,
          baseCurrency: snapshot.baseCurrency,
          categoryId,
          description: description.trim() || (amountMode === 'percentage_of_income' ? `${percentageValueStr}% от дохода` : undefined),
          date,
          status,
          amountMode,
          percentageIncomeId: amountMode === 'percentage_of_income' ? selectedIncomeId : undefined,
          percentageValue: amountMode === 'percentage_of_income' ? parseFloat(percentageValueStr) : undefined,
          reminderOffset,
          updatedAt: now,
        });
      } else {
        const expense: Expense = {
          id: generateId(),
          amount,
          currency,
          exchangeRate: snapshot.exchangeRate,
          baseAmount: snapshot.baseAmount,
          baseCurrency: snapshot.baseCurrency,
          categoryId: actualCategoryId,
          description: description.trim() || (amountMode === 'percentage_of_income' ? `${percentageValueStr}% от дохода` : undefined),
          date,
          status,
          amountMode,
          percentageIncomeId: amountMode === 'percentage_of_income' ? selectedIncomeId : undefined,
          percentageValue: amountMode === 'percentage_of_income' ? parseFloat(percentageValueStr) : undefined,
          recurringExpenseId,
          reminderOffset,
          createdAt: now,
          updatedAt: now,
        };
        await expensesRepo.add(expense);
      }

      localStorage.setItem('lastUsedExpenseCategory', categoryId);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  }

  const selectedIncomeObj = availableIncomes.find((i) => i.id === selectedIncomeId);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Sticky Header */}
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? 'Редактировать расход' : 'Добавить расход'}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>

        {/* Record Type Toggle */}
        {!isEditing && (
          <div className="px-4 pt-4 pb-0">
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${recordType === 'expense' ? 'active' : ''}`}
                onClick={() => setRecordType('expense')}
              >
                Расход
              </button>
              <button
                type="button"
                className={`segmented-btn ${recordType === 'savings' ? 'active' : ''}`}
                onClick={() => setRecordType('savings')}
              >
                В копилку
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="modal-body">
          {/* Amount Calculation Mode Toggle (for both) */}
          <div className="form-group">
            <label className="label">Способ расчёта суммы</label>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${amountMode === 'fixed' ? 'active' : ''}`}
                onClick={() => setAmountMode('fixed')}
              >
                Фиксированная сумма
              </button>
              <button
                type="button"
                className={`segmented-btn ${amountMode === 'percentage_of_income' ? 'active' : ''}`}
                onClick={() => setAmountMode('percentage_of_income')}
              >
                % от дохода
              </button>
            </div>
          </div>

          {/* If Percentage of Income Mode */}
          {amountMode === 'percentage_of_income' && (
            <div className="card p-3 bg-opacity-50 flex flex-col gap-3">
              <div className="form-group">
                <label className="label">От какого дохода считать?</label>
                <select
                  className="input"
                  value={selectedIncomeId}
                  onChange={(e) => setSelectedIncomeId(e.target.value)}
                >
                  {availableIncomes.length === 0 ? (
                    <option value="salary">Зарплата (Основной доход)</option>
                  ) : (
                    availableIncomes.map((inc) => (
                      <option key={inc.id} value={inc.id}>
                        {inc.name} — {formatAmount(inc.amount, inc.currency)}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Процент (%) от чистого дохода</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="100"
                    className="input font-medium text-lg"
                    placeholder="10"
                    value={percentageValueStr}
                    onChange={(e) => setPercentageValueStr(e.target.value)}
                  />
                  <span className="text-xl font-bold">%</span>
                </div>
              </div>

              {selectedIncomeObj && parseFloat(percentageValueStr) > 0 && (
                <div className="text-xs font-medium text-primary bg-primary-muted p-2 rounded-lg flex items-center gap-2">
                  <span>💡</span>
                  <div>
                    {percentageValueStr}% от чистого значения ({formatAmount(selectedIncomeObj.amount, selectedIncomeObj.currency)})
                    <div className="font-bold text-sm mt-0.5">
                      = {formatAmount(parseFloat(amountStr) || 0, currency)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount Input (shown for both) */}
          <div className="form-group">
            <AmountInput
              label={amountMode === 'percentage_of_income' ? 'Рассчитанная сумма' : 'Сумма'}
              amount={amountStr}
              currency={currency}
              baseCurrency={baseCurrency}
              onAmountChange={setAmountStr}
              onCurrencyChange={setCurrency}
              convertedAmount={convertedAmount}
            />
          </div>

          {recordType === 'expense' && (
            <>
              {/* Expense Type Toggle */}
          <div className="form-group">
            <label className="label">Категория</label>
            <div className="category-grid">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-btn ${categoryId === cat.id ? 'active' : ''}`}
                  onClick={() => setCategoryId(cat.id)}
                >
                  <span className="category-icon">{cat.icon}</span>
                  <span className="category-name truncate w-full">{cat.name}</span>
                </button>
              ))}
              <button
                type="button"
                className={`category-btn ${showNewCategory ? 'active' : ''}`}
                onClick={() => setShowNewCategory(!showNewCategory)}
              >
                <span className="category-icon text-primary"><Plus size={24} /></span>
                <span className="category-name truncate w-full text-primary">+ Своя</span>
              </button>
            </div>
            {showNewCategory && (
              <div className="mt-2 p-3 rounded-xl border border-border bg-bg flex items-center gap-2">
                <input 
                  type="text"
                  className="w-12 h-12 text-center text-2xl rounded-xl border border-border bg-surface outline-none focus:border-primary"
                  placeholder="📌"
                  maxLength={2}
                  value={newCatEmoji}
                  onChange={e => setNewCatEmoji(e.target.value)}
                />
                <input 
                  type="text"
                  className="input flex-1 !mb-0"
                  placeholder="Название категории"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                />
                <button 
                  type="button" 
                  className="btn-primary h-12 w-12 !p-0 flex items-center justify-center shrink-0 !rounded-xl" 
                  onClick={handleAddCategory}
                  disabled={!newCatName.trim()}
                >
                  <Plus size={20} />
                </button>
              </div>
            )}
          </div>
            </>
          )}

          {/* Date */}
          <div className="form-group">
            <label className="label">{recordType === 'expense' ? 'Дата расхода' : 'Дата пополнения'}</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Single vs Recurring Segmented Control */}
          <div className="form-group">
            <label className="label">{recordType === 'expense' ? 'Тип расхода' : 'Тип пополнения'}</label>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${expenseType === 'single' ? 'active' : ''}`}
                onClick={() => setExpenseType('single')}
              >
                Разовый
              </button>
              <button
                type="button"
                className={`segmented-btn ${expenseType === 'recurring' ? 'active' : ''}`}
                onClick={() => setExpenseType('recurring')}
              >
                Регулярный
              </button>
            </div>
          </div>

          {/* Additional fields if Recurring */}
          {expenseType === 'recurring' && (
            <div className="card p-3 flex flex-col gap-3 bg-opacity-50">
              <div className="form-group">
                <label className="label">Периодичность повторения</label>
                <select
                  className="input"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as IncomeFrequency)}
                >
                  <option value="monthly">Ежемесячно</option>
                  <option value="weekly">Еженедельно</option>
                  <option value="biweekly">Каждые 2 недели</option>
                  <option value="every_4_weeks">Каждые 4 недели</option>
                  <option value="custom">Свой интервал...</option>
                  <option value="yearly">Ежегодно</option>
                </select>
                {frequency === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-secondary">Каждые</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      className="input w-20 text-center"
                      value={customIntervalDays}
                      onChange={(e) => setCustomIntervalDays(parseInt(e.target.value) || 1)}
                    />
                    <span className="text-sm text-secondary">дней</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="label">Повторять до какого времени?</label>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-btn ${!hasEndDate ? 'active' : ''}`}
                    onClick={() => setHasEndDate(false)}
                  >
                    ♾️ Постоянно (бессрочно)
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${hasEndDate ? 'active' : ''}`}
                    onClick={() => setHasEndDate(true)}
                  >
                    📅 До даты...
                  </button>
                </div>
              </div>

              {hasEndDate && (
                <div className="form-group">
                  <label className="label">Дата окончания повторений</label>
                  <input
                    type="date"
                    className="input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Status radio buttons */}
          {recordType === 'expense' && (
          <div className="form-group">
            <label className="label">Статус расхода</label>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${status === 'completed' ? 'active' : ''}`}
                onClick={() => setStatus('completed')}
              >
                ✓ Оплачен
              </button>
              <button
                type="button"
                className={`segmented-btn ${status === 'planned' ? 'active' : ''}`}
                onClick={() => setStatus('planned')}
              >
                📋 Запланирован
              </button>
            </div>
          </div>
          )}

          {/* Individual Reminder Offset */}
          {recordType === 'expense' && expenseType === 'recurring' && (
            <div className="form-group">
              <label className="label">🔔 Напоминание об этом платеже</label>
              <CustomReminderPicker
                value={parseReminderOffset(reminderOffset)}
                onChange={(cfg) => setReminderOffset(formatReminderConfig(cfg))}
              />
            </div>
          )}

          {/* Description */}
          <div className="form-group">
            <label className="label">Описание {recordType === 'savings' && '(опционально)'}</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder={recordType === 'savings' ? 'Например: Отложил с подработки' : 'Например: Продукты в Сильпо'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={isSubmitting || !parseFloat(amountStr) || parseFloat(amountStr) <= 0}
          >
            {isEditing ? 'Сохранить изменения' : 'Добавить расход'}
          </button>
        </div>
      </div>
    </div>
  );
}
