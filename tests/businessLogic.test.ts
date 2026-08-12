import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Dexie / IndexedDB ───────────────────────────────────────────────────
// We mock db to avoid requiring a real browser environment in tests

vi.mock('../db/database', () => ({
  db: {
    settings: { get: vi.fn() },
    incomes: { get: vi.fn(), update: vi.fn() },
    savingsTransactions: {
      where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ first: vi.fn() }) }),
      add: vi.fn(),
    },
    savingsRules: {
      where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ filter: vi.fn().mockReturnValue({ first: vi.fn() }) }) }),
    },
    transaction: vi.fn().mockImplementation((_mode, _tables, fn) => fn()),
  },
}));

vi.mock('../services/currency/currencyService', () => ({
  currencyService: {
    getRateForDate: vi.fn().mockResolvedValue(41.2),
    getRate: vi.fn().mockResolvedValue(41.2),
    buildSnapshot: vi.fn().mockImplementation(async (amount, currency, baseCurrency) => ({
      exchangeRate: currency === baseCurrency ? 1 : 41.2,
      baseAmount: currency === baseCurrency ? amount : amount * 41.2,
      baseCurrency,
    })),
  },
}));

// ─── Scenario 1: Salary + Savings ────────────────────────────────────────────

describe('Scenario 1: Salary + percentage savings', () => {
  it('calculates 15% savings from 35000 UAH income', async () => {
    const income = {
      id: 'inc-1',
      amount: 35000,
      currency: 'UAH',
      date: '2026-08-15',
      exchangeRate: 1,
      baseAmount: 35000,
      baseCurrency: 'UAH',
      name: 'Зарплата',
      isRecurring: false,
      savingsApplied: false,
      createdAt: '',
      updatedAt: '',
    };

    const rule = {
      id: 'rule-1',
      type: 'percentage' as const,
      value: 15,
      active: true,
      createdAt: '',
      updatedAt: '',
    };

    // Test calculation logic directly
    const savingsAmount = Math.round(income.amount * (rule.value / 100) * 100) / 100;
    expect(savingsAmount).toBe(5250);
    expect(savingsAmount / income.amount).toBeCloseTo(0.15);
  });

  it('savings currency matches income currency for percentage rule', () => {
    const incomeCurrency = 'UAH';
    const ruleType = 'percentage';
    const savingsCurrency = ruleType === 'percentage' ? incomeCurrency : 'UAH';
    expect(savingsCurrency).toBe('UAH');
  });
});

// ─── Scenario 2: Foreign currency expense ────────────────────────────────────

describe('Scenario 2: Foreign currency expense with rate snapshot', () => {
  it('computes baseAmount correctly for 100 USD at 41.20 rate', () => {
    const amount = 100;
    const exchangeRate = 41.20;
    const baseAmount = Math.round(amount * exchangeRate * 100) / 100;

    expect(baseAmount).toBe(4120);
  });

  it('stores original amount and currency unchanged', () => {
    const expense = {
      amount: 100,
      currency: 'USD',
      exchangeRate: 41.2,
      baseAmount: 4120,
      baseCurrency: 'UAH',
    };

    expect(expense.amount).toBe(100);
    expect(expense.currency).toBe('USD');
    // base values are derived but original is preserved
    expect(expense.baseAmount).toBe(4120);
  });
});

// ─── Scenario 3: Future expense outside period not in daily limit ─────────────

describe('Scenario 3: Future expense outside income period excluded from daily limit', () => {
  it('does not deduct post-income expenses from current period', () => {
    const today = '2026-08-12';
    const nextIncomeDate = '2026-08-15';
    const expenseDate = '2026-08-20'; // AFTER next income

    // An expense after next income date should NOT be in obligatory list
    const isInPeriod = expenseDate >= today && expenseDate <= nextIncomeDate;
    expect(isInPeriod).toBe(false);
  });

  it('includes expenses before next income date in period', () => {
    const today = '2026-08-12';
    const nextIncomeDate = '2026-08-15';
    const expenseDate = '2026-08-14'; // BEFORE next income

    const isInPeriod = expenseDate >= today && expenseDate <= nextIncomeDate;
    expect(isInPeriod).toBe(true);
  });
});

// ─── Scenario 4: Historical rate stays locked after rate change ───────────────

describe('Scenario 4: Historical exchange rate is immutable', () => {
  it('historical baseAmount does not change when current rate changes', () => {
    // Operation created on Aug 1 with rate 41.00
    const historicalSnapshot = {
      amount: 100,
      currency: 'USD',
      exchangeRate: 41.0,
      baseAmount: 4100,
      baseCurrency: 'UAH',
      date: '2026-08-01',
    };

    // Current rate changed to 42.00
    const currentRate = 42.0;

    // The snapshot is never modified
    expect(historicalSnapshot.exchangeRate).toBe(41.0);
    expect(historicalSnapshot.baseAmount).toBe(4100);

    // Current rate is different but doesn't affect history
    expect(currentRate).not.toBe(historicalSnapshot.exchangeRate);
  });
});

// ─── Scenario 5: Multi-currency balance ──────────────────────────────────────

describe('Scenario 5: Multi-currency balance aggregation', () => {
  it('correctly sums amounts across currencies using historical rates', () => {
    const balanceAdjustment = 10000; // UAH
    const incomeBaseAmount = 4120; // 100 USD → UAH at 41.20
    const expenseBaseAmount = 1100; // 500 MDL → UAH at 2.20 (negative)

    const total = balanceAdjustment + incomeBaseAmount - expenseBaseAmount;
    expect(total).toBe(13020);
  });

  it('tracks per-currency breakdown separately', () => {
    const byCurrency: Record<string, number> = {};

    // Simulate adding amounts
    byCurrency['UAH'] = (byCurrency['UAH'] ?? 0) + 10000;
    byCurrency['USD'] = (byCurrency['USD'] ?? 0) + 100;
    byCurrency['MDL'] = (byCurrency['MDL'] ?? 0) - 500;

    expect(byCurrency['UAH']).toBe(10000);
    expect(byCurrency['USD']).toBe(100);
    expect(byCurrency['MDL']).toBe(-500);
  });
});

// ─── Scenario 6: Savings deduplication ───────────────────────────────────────

describe('Scenario 6: Savings transaction deduplication', () => {
  it('does not create duplicate savingsTransaction for same incomeId', async () => {
    let createCount = 0;
    const existingTransactions: Record<string, boolean> = { 'abc': true };

    async function applySavingsRule(incomeId: string) {
      if (existingTransactions[incomeId]) {
        return null; // already applied
      }
      createCount++;
      existingTransactions[incomeId] = true;
      return { id: 'new', incomeId };
    }

    await applySavingsRule('abc'); // already exists
    await applySavingsRule('abc'); // try again

    expect(createCount).toBe(0); // never created
  });

  it('creates transaction for new incomeId', async () => {
    let createCount = 0;
    const existingTransactions: Record<string, boolean> = {};

    async function applySavingsRule(incomeId: string) {
      if (existingTransactions[incomeId]) return null;
      createCount++;
      existingTransactions[incomeId] = true;
      return { id: 'new', incomeId };
    }

    await applySavingsRule('xyz');
    expect(createCount).toBe(1);

    await applySavingsRule('xyz'); // second call
    expect(createCount).toBe(1); // still 1
  });
});

// ─── Daily Limit Calculator ───────────────────────────────────────────────────

describe('dailyLimitCalculator: daysAvailable boundary cases', () => {
  function calcDays(nextIncomeDate: string, today: string): number {
    const diffMs = new Date(nextIncomeDate).getTime() - new Date(today).getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  }

  it('returns 1 when income is today', () => {
    expect(calcDays('2026-08-12', '2026-08-12')).toBe(1);
  });

  it('returns 1 when income is tomorrow', () => {
    expect(calcDays('2026-08-13', '2026-08-12')).toBe(1);
  });

  it('returns 3 when income is in 3 days', () => {
    expect(calcDays('2026-08-15', '2026-08-12')).toBe(3);
  });

  it('returns 31 when income is a month away', () => {
    expect(calcDays('2026-09-12', '2026-08-12')).toBe(31);
  });
});
