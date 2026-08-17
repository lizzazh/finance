import { useState, useEffect } from 'react';
import { db } from '../../db/database';
import { currencyService } from '../../services/currency/currencyService';
import type { CurrencyCode } from '../../types';
import { today } from '../../utils/date';
import { generateId } from '../../utils/id';
import { Save } from 'lucide-react';

interface ManualRatesManagerProps {
  baseCurrency: CurrencyCode;
}

export function ManualRatesManager({ baseCurrency }: ManualRatesManagerProps) {
  const [currencies, setCurrencies] = useState<CurrencyCode[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchUsedCurrencies() {
      const expenses = await db.expenses.toArray();
      const incomes = await db.incomes.toArray();
      const savings = await db.savingsTransactions.toArray();
      const recExp = await db.recurringExpenses.toArray();
      const recInc = await db.recurringIncomes.toArray();

      const used = new Set<string>();
      [...expenses, ...incomes, ...savings, ...recExp, ...recInc].forEach(item => {
        if (item.currency && item.currency !== baseCurrency) {
          used.add(item.currency);
        }
      });

      const usedArr = Array.from(used) as CurrencyCode[];
      setCurrencies(usedArr);

      // Fetch current rates
      const currentRates: Record<string, string> = {};
      for (const cur of usedArr) {
        const rate = await currencyService.getRateForDate(cur, baseCurrency, today());
        currentRates[cur] = rate ? rate.toString() : '';
      }
      setRates(currentRates);
    }
    fetchUsedCurrencies();
  }, [baseCurrency]);

  async function handleSave() {
    setSaving(true);
    for (const cur of currencies) {
      const val = parseFloat(rates[cur]);
      if (!isNaN(val) && val > 0) {
        await db.exchangeRates.put({
          id: generateId(),
          date: today(),
          fromCurrency: cur,
          toCurrency: baseCurrency,
          rate: val,
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  }

  if (currencies.length === 0) return null;

  return (
    <div className="card flex flex-col gap-3 mt-4 border-l-4 border-l-amber-400">
      <div className="font-semibold text-sm">Установка курсов валют</div>
      <div className="text-xs text-secondary mb-2">
        Введите текущий курс для других используемых валют по отношению к {baseCurrency}. 
        Например, если базовая UAH, а валюта USD, введите курс (напр. 41.5).
      </div>
      <div className="flex flex-col gap-3">
        {currencies.map(cur => (
          <div key={cur} className="flex justify-between items-center bg-surface p-2 rounded-lg">
            <span className="font-bold text-sm w-16">{cur}</span>
            <input
              type="number"
              step="0.01"
              className="input text-right w-32"
              placeholder={`Курс к ${baseCurrency}`}
              value={rates[cur] || ''}
              onChange={e => setRates(prev => ({ ...prev, [cur]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <button 
        className="btn-primary mt-2 flex justify-center items-center gap-2" 
        onClick={handleSave} 
        disabled={saving}
      >
        <Save size={16} />
        {saving ? 'Сохранение...' : success ? 'Сохранено!' : 'Сохранить курсы'}
      </button>
    </div>
  );
}
