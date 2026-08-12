import { db } from '../db/database';
import { today, addDays, differenceInDays } from '../utils/date';
import { formatAmount } from '../utils/format';
import type { ReminderOffset } from '../types';

export interface UpcomingReminder {
  id: string;
  type: 'expense' | 'income';
  title: string;
  amount: number;
  currency: string;
  date: string;
  daysUntil: number;
  reminderLabel?: string;
}

function offsetToMaxDays(offset?: ReminderOffset, defaultDays = 1): number {
  if (offset === 'none') return -1;
  if (offset === '1_hour' || offset === '2_hours' || offset === '3_hours') return 0;
  if (offset === '1_day') return 1;
  if (offset === '2_days') return 2;
  if (offset === '3_days') return 3;
  if (offset === '1_week') return 7;
  if (offset === '2_weeks') return 14;
  if (offset === '3_weeks') return 21;
  return defaultDays;
}

function formatOffsetLabel(offset?: ReminderOffset): string | undefined {
  switch (offset) {
    case '1_hour':
      return 'За 1 час';
    case '2_hours':
      return 'За 2 часа';
    case '3_hours':
      return 'За 3 часа';
    case '1_day':
      return 'За 1 день';
    case '2_days':
      return 'За 2 дня';
    case '3_days':
      return 'За 3 дня';
    case '1_week':
      return 'За 1 неделю';
    case '2_weeks':
      return 'За 2 недели';
    case '3_weeks':
      return 'За 3 недели';
    default:
      return undefined;
  }
}

export const reminderService = {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  },

  getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!reminderService.isSupported()) return 'unsupported';
    return Notification.permission;
  },

  async requestPermission(): Promise<boolean> {
    if (!reminderService.isSupported()) return false;
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  },

  async getUpcomingReminders(): Promise<UpcomingReminder[]> {
    const settings = await db.settings.toArray();
    const settingsMap: Record<string, any> = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    const enabled = settingsMap['reminderEnabled'] ?? true;
    if (!enabled) return [];

    const globalDefaultDays = Number(settingsMap['reminderDaysAhead'] ?? 1);
    const todayStr = today();

    const [plannedExpenses, recurringIncomes, categories] = await Promise.all([
      db.expenses.where('status').equals('planned').toArray(),
      db.recurringIncomes.where('active').equals(1).toArray(),
      db.categories.toArray(),
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const reminders: UpcomingReminder[] = [];

    // Check planned expenses
    for (const exp of plannedExpenses) {
      const targetDays = exp.reminderOffset ? offsetToMaxDays(exp.reminderOffset, globalDefaultDays) : globalDefaultDays;
      if (targetDays < 0) continue; // Disabled for this payment

      const maxTargetDate = addDays(todayStr, targetDays);
      if (exp.date >= todayStr && exp.date <= maxTargetDate) {
        const diff = differenceInDays(todayStr, exp.date);
        const cat = catMap.get(exp.categoryId);
        reminders.push({
          id: `exp_${exp.id}`,
          type: 'expense',
          title: exp.description || cat?.name || 'Плановый расход',
          amount: exp.amount,
          currency: exp.currency,
          date: exp.date,
          daysUntil: diff,
          reminderLabel: formatOffsetLabel(exp.reminderOffset),
        });
      }
    }

    // Check upcoming recurring incomes
    for (const inc of recurringIncomes) {
      const targetDays = inc.reminderOffset ? offsetToMaxDays(inc.reminderOffset, globalDefaultDays) : globalDefaultDays;
      if (targetDays < 0) continue;

      const maxTargetDate = addDays(todayStr, targetDays);
      if (inc.nextDate >= todayStr && inc.nextDate <= maxTargetDate) {
        const diff = differenceInDays(todayStr, inc.nextDate);
        reminders.push({
          id: `inc_${inc.id}`,
          type: 'income',
          title: `${inc.name} (ожидается)`,
          amount: inc.amount,
          currency: inc.currency,
          date: inc.nextDate,
          daysUntil: diff,
          reminderLabel: formatOffsetLabel(inc.reminderOffset),
        });
      }
    }

    reminders.sort((a, b) => a.daysUntil - b.daysUntil);
    return reminders;
  },

  async triggerNativeNotifications(): Promise<void> {
    if (reminderService.getPermissionStatus() !== 'granted') return;

    const reminders = await reminderService.getUpcomingReminders();
    for (const rem of reminders) {
      const daysText = rem.daysUntil === 0 ? 'сегодня' : rem.daysUntil === 1 ? 'завтра' : `через ${rem.daysUntil} дн.`;
      const noteLabel = rem.reminderLabel ? ` [${rem.reminderLabel}]` : '';
      const body = `${rem.type === 'expense' ? '🏠 Расход' : '💰 Доход'}: ${rem.title} — ${formatAmount(rem.amount, rem.currency)} (${daysText})${noteLabel}`;

      try {
        new Notification('🔔 Финансовый планировщик', {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: rem.id,
        });
      } catch {
        // Notification failed or blocked
      }
    }
  },
};
