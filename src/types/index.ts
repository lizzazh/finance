// ─── Core Types ──────────────────────────────────────────────────────────────

export type CurrencyCode = string; // ISO 4217, e.g. 'UAH', 'USD', 'EUR'

export type ExpenseStatus = 'planned' | 'completed' | 'cancelled';
export type SavingsRuleType = 'percentage' | 'fixed' | 'none';
export type IncomeFrequency = 'weekly' | 'biweekly' | 'every_4_weeks' | 'monthly' | 'yearly' | 'custom';
export type BalanceAdjustmentType = 'opening' | 'adjustment';
export type ExchangeRateSource = 'api' | 'manual';
export type CategoryType = 'expense' | 'income';
export type ThemeMode = 'light' | 'dark' | 'system';
export type CurrencyRateMode = 'auto' | 'manual';
export type ReminderOffset = string;

// ─── Expense ─────────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number;
  baseAmount: number;
  baseCurrency: CurrencyCode;
  categoryId: string;
  description?: string;
  date: string; // 'YYYY-MM-DD'
  status: ExpenseStatus;
  amountMode?: 'fixed' | 'percentage_of_income';
  percentageIncomeId?: string;
  percentageValue?: number;
  recurringExpenseId?: string;
  reminderOffset?: ReminderOffset;
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

// ─── Income ──────────────────────────────────────────────────────────────────

export interface Income {
  id: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number;
  baseAmount: number;
  baseCurrency: CurrencyCode;
  name: string;
  description?: string;
  date: string; // 'YYYY-MM-DD'
  status?: 'received' | 'pending';
  grossAmount?: number;
  taxPercent?: number;
  fixedTaxAmount?: number;
  isRecurring: boolean;
  recurringIncomeId?: string;
  savingsApplied: boolean;
  reminderOffset?: ReminderOffset;
  createdAt: string;
  updatedAt: string;
}

// ─── Recurring Income (Template) ─────────────────────────────────────────────

export interface RecurringIncome {
  id: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  frequency: IncomeFrequency;
  grossAmount?: number;
  taxPercent?: number;
  fixedTaxAmount?: number;
  dayOfMonth?: number;
  customIntervalDays?: number;
  customIntervalUnit?: 'days' | 'weeks' | 'months';
  startDate?: string; // 'YYYY-MM-DD' initial start date chosen by user
  nextDate: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD' if set, otherwise indefinite
  active: boolean;
  reminderOffset?: ReminderOffset;
  createdAt: string;
  updatedAt: string;
}

// ─── Recurring Expense (Template) ────────────────────────────────────────────

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  categoryId: string;
  frequency: IncomeFrequency;
  dayOfMonth?: number;
  customIntervalDays?: number;
  customIntervalUnit?: 'days' | 'weeks' | 'months';
  amountMode?: 'fixed' | 'percentage_of_income';
  percentageIncomeId?: string;
  percentageValue?: number;
  startDate?: string; // 'YYYY-MM-DD' initial start date chosen by user
  nextDate: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD' if set, otherwise indefinite
  active: boolean;
  reminderOffset?: ReminderOffset;
  createdAt: string;
  updatedAt: string;
}

// ─── Savings Rule ─────────────────────────────────────────────────────────────

export interface SavingsRule {
  id: string;
  type: SavingsRuleType;
  value: number;
  currency?: CurrencyCode; // for 'fixed' type
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Savings Transaction ─────────────────────────────────────────────────────

export interface SavingsTransaction {
  id: string;
  incomeId: string; // unique FK — one per income
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number;
  baseAmount: number;
  baseCurrency: CurrencyCode;
  ruleId: string;
  ruleType: 'percentage' | 'fixed';
  ruleValue: number;
  date: string; // 'YYYY-MM-DD'
  createdAt: string;
}

// ─── Balance Adjustment ───────────────────────────────────────────────────────

export interface BalanceAdjustment {
  id: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number;
  baseAmount: number;
  baseCurrency: CurrencyCode;
  date: string; // 'YYYY-MM-DD'
  type: BalanceAdjustmentType;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Exchange Rate ────────────────────────────────────────────────────────────

export interface ExchangeRate {
  id: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  date: string; // 'YYYY-MM-DD'
  source: ExchangeRateSource;
  provider?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Category ────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: CategoryType;
  isDefault: boolean;
  createdAt: string;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface Setting {
  key: string;
  value: string | number | boolean | null;
}

export interface AppSettings {
  baseCurrency: CurrencyCode;
  currencyRateMode: CurrencyRateMode;
  lastRatesUpdate: string | null;
  theme: ThemeMode;
  monthlyBudget: number;
  onboardingCompleted: boolean;
  planningIncomeSourceId: string | null;
  reminderEnabled: boolean;
  reminderDaysAhead: number; // 0, 1, 2, 3, 7 days before
  reminderOffset?: string;
}

// ─── Computed / Service Types ─────────────────────────────────────────────────

export interface CurrentBalance {
  total: number;
  byCurrency: Record<CurrencyCode, number>;
  baseCurrency: CurrencyCode;
}

export interface IncomePeriod {
  startDate: string;
  endDate: string;
  planningIncomeSourceId: string | null;
  expectedIncome: number;
  expectedIncomeCurrency: CurrencyCode;
}

export interface Forecast {
  nextIncomeDate: string;
  expectedIncome: number;
  plannedSavings: number;
  obligatoryExpenses: number;
  forecastBalance: number;
  isNegative: boolean;
  baseCurrency: CurrencyCode;
}

export interface DashboardData {
  currentBalance: CurrentBalance;
  availableBalance: number;
  availableAfterSavings: number;
  dailyLimit: number;
  monthlyExpenses: number;
  monthlyIncome: number;
  monthlySavings: number;
  monthlyBudget: number;
  forecast: Forecast | null;
  period: IncomePeriod | null;
  recentExpenses: Expense[];
  upcomingEvents: UpcomingEvent[];
}

export interface UpcomingEvent {
  date: string;
  type: 'income' | 'expense' | 'savings';
  name: string;
  amount: number;
  currency: CurrencyCode;
  baseAmount: number;
  daysUntil: number;
  icon?: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface DailyExpense {
  date: string;
  amount: number;
  count: number;
  categoryNames?: string; // comma-separated list of category names for tooltip
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface MonthlyComparison {
  month: string; // 'YYYY-MM'
  income: number;
  expenses: number;
  savings: number;
  balance: number;
}

// ─── Currency ────────────────────────────────────────────────────────────────

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  symbol: string;
  flag: string;
}

// ─── Export/Import ───────────────────────────────────────────────────────────

export interface ExportData {
  schemaVersion: number;
  exportedAt: string;
  baseCurrency: CurrencyCode;
  data: {
    expenses: Expense[];
    incomes: Income[];
    recurringIncomes: RecurringIncome[];
    recurringExpenses: RecurringExpense[];
    savingsRules: SavingsRule[];
    savingsTransactions: SavingsTransaction[];
    balanceAdjustments: BalanceAdjustment[];
    exchangeRates: ExchangeRate[];
    categories: Category[];
    settings: Setting[];
  };
}
