import type { CurrencyCode } from '../../types';

/**
 * Abstract interface for currency rate providers.
 * Swap providers by replacing one file in providers/.
 */
export interface CurrencyProvider {
  getName(): string;
  /**
   * Fetch rates where 1 unit of baseCurrency equals X units of other currencies.
   * Returns a map: { 'USD': 0.0244, 'EUR': 0.0226, ... } when baseCurrency is 'UAH'
   * NOTE: NBU API returns UAH per 1 unit of foreign currency, so the provider must invert.
   */
  getRates(baseCurrency: CurrencyCode): Promise<Record<CurrencyCode, number>>;
}
