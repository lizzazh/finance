import { useState } from 'react';
import { X } from 'lucide-react';
import { AmountInput } from '../ui/AmountInput';
import { db } from '../../db/database';
import { currencyService } from '../../services/currency/currencyService';
import { generateId } from '../../utils/id';
import { today } from '../../utils/date';
import { useSettings } from '../../hooks/useSettings';
import type { CurrencyCode } from '../../types';

interface AddSavingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AddSavingsModal({ open, onClose, onSaved }: AddSavingsModalProps) {
  const { settings } = useSettings();
  const baseCurrency = settings?.baseCurrency || 'UAH';

  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('UAH');
  const [date, setDate] = useState(today());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial currency with baseCurrency
  useState(() => {
    if (baseCurrency) setCurrency(baseCurrency);
  });

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) return;

    setIsSubmitting(true);
    try {
      let exchangeRate = 1;
      let baseAmount = amount;

      if (currency !== baseCurrency) {
        const rate = await currencyService.getRateForDate(currency, baseCurrency, date);
        if (rate !== null) {
          exchangeRate = rate;
          baseAmount = Math.round(amount * rate * 100) / 100;
        } else {
          // If no rate, default to 1 and warn or just save
          exchangeRate = 1;
          baseAmount = amount;
        }
      }

      const now = new Date().toISOString();
      await db.savingsTransactions.add({
        id: generateId(),
        incomeId: 'manual', // Identifier for manual savings
        amount,
        currency,
        exchangeRate,
        baseAmount,
        baseCurrency,
        ruleId: 'manual',
        ruleType: 'fixed',
        ruleValue: amount,
        date,
        createdAt: now
      });

      if (onSaved) onSaved();
      setAmountStr('');
      onClose();
    } catch (err) {
      console.error('Error saving manual savings:', err);
      alert('Ошибка при сохранении');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Отложить в накопления</h2>
          <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="form-group">
            <label className="label">Сумма</label>
            <AmountInput
              amount={amountStr}
              currency={currency}
              baseCurrency={baseCurrency}
              onAmountChange={setAmountStr}
              onCurrencyChange={setCurrency}
            />
          </div>

          <div className="form-group">
            <label className="label">Дата</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-3 mt-4 pt-4 border-t border-border">
            <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isSubmitting}>
              Отмена
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting || !parseFloat(amountStr)}>
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
