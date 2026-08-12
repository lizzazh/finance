import { getCurrencyInfo } from './currencies';

export function compactNumber(n: number): string {
  return n.toLocaleString('ru-RU').replace(/,/g, ' ');
}

export function getCurrencySymbol(currency: string): string {
  const info = getCurrencyInfo(currency);
  return info?.symbol ?? currency;
}

export function formatAmount(
  amount: number,
  currency: string,
  options?: { showApprox?: boolean; compact?: boolean }
): string {
  const symbol = getCurrencySymbol(currency);
  const numStr = options?.compact ? compactNumber(amount) : amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  const prefix = options?.showApprox ? '≈ ' : '';
  return `${prefix}${numStr} ${symbol}`;
}

export function formatAmountWithBase(
  amount: number,
  currency: string,
  baseAmount: number,
  baseCurrency: string
): { primary: string; secondary: string | null } {
  const primary = formatAmount(baseAmount, baseCurrency);
  let secondary = null;
  if (currency !== baseCurrency) {
    secondary = formatAmount(amount, currency);
  }
  return { primary, secondary };
}
