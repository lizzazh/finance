import { useState, useEffect, useCallback } from 'react';
import type { CurrencyCode } from '../types';
import { currencyService } from '../services/currency/currencyService';
import { formatAmount as formatAmountUtil } from '../utils/format';
import { db } from '../db/database';

export function useCurrency() {
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('UAH');
  const [loading, setLoading] = useState(true);

  const loadBaseCurrency = useCallback(async () => {
    try {
      setLoading(true);
      const setting = await db.settings.get('baseCurrency');
      const base = (setting?.value as CurrencyCode) || 'UAH';
      setBaseCurrency(base);
    } catch (err) {
      console.error('Error loading base currency', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseCurrency();
  }, [loadBaseCurrency]);

  const getRate = async (from: string, to: string): Promise<number> => {
    const rate = await currencyService.getRate(from, to);
    return rate ?? 1;
  };

  const convert = (amount: number, rate: number): number => {
    return Math.round(amount * rate * 100) / 100;
  };

  const formatAmount = (amount: number, currency: string): string => {
    return formatAmountUtil(amount, currency);
  };

  const refreshRates = async (): Promise<void> => {
    try {
      setLoading(true);
      await currencyService.refreshRates();
    } catch (err) {
      console.error('Error refreshing rates', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    baseCurrency,
    getRate,
    convert,
    formatAmount,
    refreshRates,
    loading
  };
}
