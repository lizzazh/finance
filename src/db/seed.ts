import { db } from './database';
import type { Category, Setting } from '../types';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-housing', name: 'Жильё', icon: '🏠', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-utilities', name: 'Коммунальные', icon: '💡', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-groceries', name: 'Продукты', icon: '🛒', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-transport', name: 'Транспорт', icon: '🚕', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-mobile', name: 'Связь', icon: '📱', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-internet', name: 'Интернет', icon: '🌐', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-banking', name: 'Банк', icon: '💳', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-entertainment', name: 'Развлечения', icon: '🎮', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-clothing', name: 'Одежда', icon: '👕', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-health', name: 'Здоровье', icon: '💊', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-gifts', name: 'Подарки', icon: '🎁', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-shopping', name: 'Покупки', icon: '🛍', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-cafe', name: 'Кафе', icon: '☕', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-other', name: 'Другое', icon: '📦', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-wife', name: 'Жена', icon: '👩', type: 'expense', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-salary', name: 'Зарплата', icon: '💰', type: 'income', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'cat-freelance', name: 'Фриланс', icon: '💻', type: 'income', isDefault: true, createdAt: new Date().toISOString() },
];

const DEFAULT_SETTINGS: Setting[] = [
  { key: 'baseCurrency', value: 'UAH' },
  { key: 'currencyRateMode', value: 'auto' },
  { key: 'lastRatesUpdate', value: null },
  { key: 'theme', value: 'system' },
  { key: 'monthlyBudget', value: 0 },
  { key: 'onboardingCompleted', value: false },
  { key: 'planningIncomeSourceId', value: null },
  { key: 'reminderEnabled', value: true },
  { key: 'reminderDaysAhead', value: 1 },
];

export async function seedDatabase(): Promise<void> {
  const existing = await db.categories.toArray();
  const missing = DEFAULT_CATEGORIES.filter((def) => !existing.some((e) => e.id === def.id || e.name === def.name));
  if (missing.length > 0) {
    await db.categories.bulkAdd(missing);
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkPut(DEFAULT_SETTINGS);
  }
}
