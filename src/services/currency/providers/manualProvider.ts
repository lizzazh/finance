import type { CurrencyProvider } from '../currencyProvider';
import type { CurrencyCode } from '../../../types';

/**
 * ManualProvider — returns rates that the user has entered manually.
 * Used as a fallback when NBU is unavailable or as the primary mode
 * when currencyRateMode = 'manual'.
 *
 * Rates are managed externally (via currencyService / IndexedDB).
 * This provider acts as a passthrough that always throws
 * "manual mode — use cached rates" so currencyService handles the fallback.
 */
export class ManualProvider implements CurrencyProvider {
  getName(): string {
    return 'Manual';
  }

  async getRates(_baseCurrency: CurrencyCode): Promise<Record<CurrencyCode, number>> {
    // ManualProvider does not fetch from network.
    // currencyService will use cached IndexedDB rates directly.
    throw new Error('ManualProvider: use cached rates from IndexedDB');
  }
}

export const manualProvider = new ManualProvider();
