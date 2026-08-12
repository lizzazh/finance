import { CurrencyPicker } from './CurrencyPicker';
import type { CurrencyCode } from '../../types';

interface AmountInputProps {
  amount: string;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
  convertedAmount?: number;
  label?: string;
  placeholder?: string;
}

export function AmountInput({
  amount,
  currency,
  baseCurrency,
  onAmountChange,
  onCurrencyChange,
  convertedAmount,
  label,
  placeholder = '0.00'
}: AmountInputProps) {
  // Format converted amount
  const formattedConverted = convertedAmount !== undefined 
    ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: baseCurrency }).format(convertedAmount)
    : undefined;

  return (
    <div className="form-group">
      {label && <label className="label">{label}</label>}
      <div className="flex gap-2 items-start relative">
        <div className="flex-1">
          <input
            type="number"
            step="0.01"
            min="0"
            className="input w-full text-lg font-medium"
            placeholder={placeholder}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
          />
          {currency !== baseCurrency && formattedConverted && (
            <div className="text-sm text-secondary mt-1">
              &approx; {formattedConverted}
            </div>
          )}
        </div>
        <CurrencyPicker 
          value={currency} 
          onChange={onCurrencyChange}
        />
      </div>
    </div>
  );
}
