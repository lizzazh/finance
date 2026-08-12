import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AmountInput } from '../ui/AmountInput';
import { incomesRepo, recurringIncomesRepo, savingsRulesRepo } from '../../db/repositories';
import { currencyService } from '../../services/currency/currencyService';
import { savingsCalculator } from '../../services/savingsCalculator';
import { generateId } from '../../utils/id';
import { today, getNextRecurringDate } from '../../utils/date';
import { useSettings } from '../../hooks/useSettings';
import { recurringIncomeService } from '../../services/recurringIncome';
import { CustomReminderPicker, parseReminderOffset, formatReminderConfig } from '../ui/CustomReminderPicker';
import type { CurrencyCode, IncomeFrequency, SavingsRule, Income, ReminderOffset } from '../../types';
import { formatAmount } from '../../utils/format';

interface AddIncomeModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialIncome?: Income | null;
  initialDate?: string;
}

export function AddIncomeModal({ open, onClose, onSaved, initialIncome, initialDate }: AddIncomeModalProps) {
  const { settings } = useSettings();
  const baseCurrency = settings?.baseCurrency || 'UAH';

  const [name, setName] = useState('');
  const [grossAmountStr, setGrossAmountStr] = useState('');
  const [taxPercentStr, setTaxPercentStr] = useState('19.5'); // default 19.5% for UA (18% NDFO + 1.5% Military)
  const [fixedTaxStr, setFixedTaxStr] = useState('0');
  const [currency, setCurrency] = useState<CurrencyCode>('UAH');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'received' | 'pending'>('received');
  const [reminderOffset, setReminderOffset] = useState<ReminderOffset>('1_day');

  // Income type: single vs recurring
  const [incomeType, setIncomeType] = useState<'single' | 'recurring'>('single');
  const [frequency, setFrequency] = useState<IncomeFrequency>('monthly');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState<number>(new Date().getDate());
  const [customIntervalDays, setCustomIntervalDays] = useState(30);

  const [activeRule, setActiveRule] = useState<SavingsRule | null>(null);
  const [savingsPreview, setSavingsPreview] = useState<string | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!initialIncome;

  // Math for gross -> tax -> net
  const gross = parseFloat(grossAmountStr) || 0;
  const taxPct = Math.max(0, parseFloat(taxPercentStr) || 0);
  const taxFromPct = Math.round(gross * (taxPct / 100) * 100) / 100;
  const fixedTax = Math.max(0, parseFloat(fixedTaxStr) || 0);
  const totalTax = taxFromPct + fixedTax;
  const netIncome = Math.max(0, Math.round((gross - totalTax) * 100) / 100);

  useEffect(() => {
    if (open) {
      document.body.classList.add('modal-open');
      if (initialIncome) {
        setName(initialIncome.name);
        setGrossAmountStr(String(initialIncome.grossAmount ?? initialIncome.amount));
        setTaxPercentStr(String(initialIncome.taxPercent ?? 0));
        setFixedTaxStr(String(initialIncome.fixedTaxAmount ?? 0));
        setCurrency(initialIncome.currency);
        setDate(initialIncome.date);
        setDescription(initialIncome.description || '');
        setStatus(initialIncome.status || 'received');
        setReminderOffset(initialIncome.reminderOffset || '1_day');
        setIncomeType(initialIncome.isRecurring ? 'recurring' : 'single');
      } else {
        setName('');
        setGrossAmountStr('');
        setTaxPercentStr('19.5');
        setFixedTaxStr('0');
        const curDate = initialDate || today();
        setDate(curDate);
        setDescription('');
        setStatus('received');
        setReminderOffset('1_day');
        setIncomeType('single');
        setFrequency('monthly');
        setDayOfMonth(new Date().getDate());
        setIsSubmitting(false);
        setCurrency(settings?.baseCurrency || 'UAH');
      }

      savingsRulesRepo.getActive().then((rules) => {
        const active = rules.find((r) => r.type !== 'none');
        setActiveRule(active || null);
      });
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open, settings, initialIncome, initialDate]);

  useEffect(() => {
    if (netIncome > 0 && currency !== baseCurrency) {
      currencyService
        .getRate(currency, baseCurrency, date)
        .then((rate) => setConvertedAmount(currencyService.convert(netIncome, rate)))
        .catch(() => setConvertedAmount(undefined));
    } else {
      setConvertedAmount(undefined);
    }

    if (activeRule && netIncome > 0) {
      savingsCalculator
        .preview({ amount: netIncome, currency, date }, activeRule, baseCurrency)
        .then((preview) => {
          if (preview) {
            const formatted = formatAmount(preview.amount, preview.currency);
            if (activeRule.type === 'percentage') {
              setSavingsPreview(
                `Накопления (${activeRule.value}% от чистого дохода): ${formatted}`,
              );
            } else {
              setSavingsPreview(`Накопления: ${formatted}`);
            }
          }
        });
    } else {
      setSavingsPreview(null);
    }
  }, [grossAmountStr, taxPercentStr, netIncome, currency, baseCurrency, date, activeRule]);

  if (!open) return null;

  async function handleSave() {
    if (netIncome <= 0 || !name.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const snapshot = await currencyService.buildSnapshot(netIncome, currency, baseCurrency, date);
      const now = new Date().toISOString();
      const incomeId = generateId();

      let recurringIncomeId: string | undefined = initialIncome?.recurringIncomeId;

      if (incomeType === 'recurring') {
        const startDayOfMonth = parseInt(date.slice(8, 10)) || dayOfMonth;
        const computedNextDate = getNextRecurringDate(date, frequency, startDayOfMonth);

        if (recurringIncomeId) {
          await recurringIncomesRepo.update(recurringIncomeId, {
            name: name.trim(),
            amount: netIncome,
            currency,
            frequency,
            dayOfMonth: frequency === 'monthly' ? startDayOfMonth : undefined,
            customIntervalDays: frequency === 'custom' ? customIntervalDays : undefined,
            startDate: date,
            nextDate: computedNextDate,
            endDate: hasEndDate && endDate ? endDate : undefined,
            active: true,
            reminderOffset,
            updatedAt: now,
          });
        } else {
          recurringIncomeId = generateId();
          await recurringIncomesRepo.add({
            id: recurringIncomeId,
            name: name.trim(),
            amount: netIncome,
            currency,
            frequency,
            dayOfMonth: frequency === 'monthly' ? startDayOfMonth : undefined,
            customIntervalDays: frequency === 'custom' ? customIntervalDays : undefined,
            startDate: date,
            nextDate: computedNextDate,
            endDate: hasEndDate && endDate ? endDate : undefined,
            active: true,
            reminderOffset,
            createdAt: now,
            updatedAt: now,
          });
        }
        await recurringIncomeService.processSingle(recurringIncomeId);
      }

      if (isEditing && initialIncome) {
        await incomesRepo.update(initialIncome.id, {
          amount: netIncome,
          currency,
          exchangeRate: snapshot.exchangeRate,
          baseAmount: snapshot.baseAmount,
          baseCurrency: snapshot.baseCurrency,
          name: name.trim(),
          grossAmount: gross,
          taxPercent: taxPct,
          fixedTaxAmount: fixedTax,
          status,
          description:
            description.trim() ||
            (totalTax > 0
              ? `Доход до налогов: ${formatAmount(gross, currency)}, Налог: ${formatAmount(totalTax, currency)}`
              : undefined),
          date,
          isRecurring: incomeType === 'recurring',
          reminderOffset,
          updatedAt: now,
        });
      } else {
        await incomesRepo.add({
          id: incomeId,
          amount: netIncome,
          currency,
          exchangeRate: snapshot.exchangeRate,
          baseAmount: snapshot.baseAmount,
          baseCurrency: snapshot.baseCurrency,
          name: name.trim(),
          grossAmount: gross,
          taxPercent: taxPct,
          fixedTaxAmount: fixedTax,
          status,
          description:
            description.trim() ||
            (totalTax > 0
              ? `Доход до налогов: ${formatAmount(gross, currency)}, Налог: ${formatAmount(totalTax, currency)}`
              : undefined),
          date,
          isRecurring: incomeType === 'recurring',
          recurringIncomeId,
          savingsApplied: false,
          reminderOffset,
          createdAt: now,
          updatedAt: now,
        });

        // Apply savings rule to net income if received
        if (status === 'received') {
          await savingsCalculator.applySavingsRule(incomeId);
        }
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Sticky Header */}
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? 'Редактировать доход' : 'Добавить доход'}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body">
          {/* Income Name */}
          <div className="form-group">
            <label className="label">Название (например: Зарплата)</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название"
            />
          </div>

          {/* Amount before taxes (Gross) */}
          <AmountInput
            label="Сумма до налогов"
            amount={grossAmountStr}
            currency={currency}
            baseCurrency={baseCurrency}
            onAmountChange={setGrossAmountStr}
            onCurrencyChange={setCurrency}
          />

          {/* Tax % and Fixed Tax Card */}
          <div className="card p-3 bg-opacity-50 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-4">
              <label className="label mb-0">Налог (%)</label>
              <div className="flex items-center gap-1 w-28">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="input text-right py-1 px-2 text-sm"
                  value={taxPercentStr}
                  onChange={(e) => setTaxPercentStr(e.target.value)}
                />
                <span className="text-sm font-medium">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="label mb-0">Фиксированный налог (сумма)</label>
              <div className="flex items-center gap-1 w-36">
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="input text-right py-1 px-2 text-sm"
                  placeholder="0"
                  value={fixedTaxStr}
                  onChange={(e) => setFixedTaxStr(e.target.value)}
                />
                <span className="text-xs font-medium">{currency}</span>
              </div>
            </div>

            {gross > 0 && (
              <div className="pt-2 border-t border-border flex flex-col gap-1 text-sm">
                {taxFromPct > 0 && (
                  <div className="flex justify-between text-secondary">
                    <span>Процентный налог ({taxPct}%):</span>
                    <span className="text-expense">− {formatAmount(taxFromPct, currency)}</span>
                  </div>
                )}
                {fixedTax > 0 && (
                  <div className="flex justify-between text-secondary">
                    <span>Фиксированный налог:</span>
                    <span className="text-expense">− {formatAmount(fixedTax, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-income pt-1">
                  <span>Чистый доход:</span>
                  <span>= {formatAmount(netIncome, currency)}</span>
                </div>
                {convertedAmount !== undefined && currency !== baseCurrency && (
                  <div className="text-xs text-right text-secondary">
                    ≈ {formatAmount(convertedAmount, baseCurrency)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Savings Notice */}
          {savingsPreview && gross > 0 && (
            <div className="text-sm font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
              <span>💰</span>
              <div>
                <div>{savingsPreview}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">
                  Рассчитывается от чистого дохода ({formatAmount(netIncome, currency)})
                </div>
              </div>
            </div>
          )}

          {/* Date */}
          <div className="form-group">
            <label className="label">
              {incomeType === 'recurring' ? 'Дата первого получения (старт)' : 'Дата получения'}
            </label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Status Segmented Control */}
          <div className="form-group">
            <label className="label">Статус дохода</label>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${status === 'received' ? 'active' : ''}`}
                onClick={() => setStatus('received')}
              >
                ✓ Пришёл (Получен)
              </button>
              <button
                type="button"
                className={`segmented-btn ${status === 'pending' ? 'active' : ''}`}
                onClick={() => setStatus('pending')}
              >
                ⏳ Ожидается
              </button>
            </div>
          </div>



          {/* Income Type Segmented Toggle */}
          <div className="form-group">
            <label className="label">Тип дохода</label>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${incomeType === 'single' ? 'active' : ''}`}
                onClick={() => setIncomeType('single')}
              >
                Разовый
              </button>
              <button
                type="button"
                className={`segmented-btn ${incomeType === 'recurring' ? 'active' : ''}`}
                onClick={() => setIncomeType('recurring')}
              >
                Регулярный
              </button>
            </div>
          </div>

          {/* Recurring Options */}
          {incomeType === 'recurring' && (
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

          {/* Optional Description */}
          <div className="form-group">
            <label className="label">Описание (необязательно)</label>
            <input
              type="text"
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Дополнительные заметки"
            />
          </div>

          {/* Reminder Offset */}
          <div className="form-group">
            <label className="label">🔔 Напоминание об этом доходе</label>
            <CustomReminderPicker
              value={parseReminderOffset(reminderOffset)}
              onChange={(cfg) => setReminderOffset(formatReminderConfig(cfg))}
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
            disabled={isSubmitting || netIncome <= 0 || !name.trim()}
          >
            {isEditing ? 'Сохранить изменения' : 'Добавить доход'}
          </button>
        </div>
      </div>
    </div>
  );
}
