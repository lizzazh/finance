import { format, parseISO, differenceInDays as dfnsDifferenceInDays, addDays as dfnsAddDays, addMonths as dfnsAddMonths, isBefore as dfnsIsBefore, isAfter as dfnsIsAfter, startOfMonth as dfnsStartOfMonth, endOfMonth as dfnsEndOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';

export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toCalendarDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toDisplayDate(date: string, formatStr: 'short' | 'long' = 'long'): string {
  try {
    const cleanDateStr = date.split('T')[0];
    const [y, m, d] = cleanDateStr.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    if (formatStr === 'short') {
      return format(parsed, 'd MMM', { locale: ru });
    }
    return format(parsed, 'd MMMM yyyy', { locale: ru });
  } catch (e) {
    return date;
  }
}

export function toDisplayMonth(date: string): string {
  try {
    const cleanDateStr = date.split('T')[0];
    const [y, m, d] = cleanDateStr.split('-').map(Number);
    const parsed = new Date(y, m - 1, d || 1);
    const formatted = format(parsed, 'LLLL yyyy', { locale: ru });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (e) {
    return date;
  }
}

export function differenceInDays(from: string, to: string): number {
  return dfnsDifferenceInDays(parseISO(from), parseISO(to));
}

export function addDays(date: string, days: number): string {
  const cleanDateStr = date.split('T')[0];
  const [y, m, d] = cleanDateStr.split('-').map(Number);
  return toCalendarDate(dfnsAddDays(new Date(y, m - 1, d), days));
}

export function addMonths(date: string, months: number): string {
  const cleanDateStr = date.split('T')[0];
  const [y, m, d] = cleanDateStr.split('-').map(Number);
  return toCalendarDate(dfnsAddMonths(new Date(y, m - 1, d), months));
}

export function isBefore(a: string, b: string): boolean {
  return a.split('T')[0] < b.split('T')[0];
}

export function isAfter(a: string, b: string): boolean {
  return a.split('T')[0] > b.split('T')[0];
}

export function isSameOrBefore(a: string, b: string): boolean {
  return a.split('T')[0] <= b.split('T')[0];
}

export function getNextRecurringDate(currentDate: string, frequency: string, dayOfMonth?: number, customIntervalDays?: number): string {
  const cleanDateStr = currentDate.split('T')[0];
  const [y, m, d] = cleanDateStr.split('-').map(Number);
  let nextDate = new Date(y, m - 1, d);
  
  if (frequency === 'monthly') {
    nextDate = dfnsAddMonths(nextDate, 1);
    if (dayOfMonth !== undefined) {
      const year = nextDate.getFullYear();
      const month = nextDate.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const targetDay = Math.min(dayOfMonth, lastDay);
      nextDate = new Date(year, month, targetDay);
    }
  } else if (frequency === 'weekly') {
    nextDate = dfnsAddDays(nextDate, 7);
  } else if (frequency === 'biweekly') {
    nextDate = dfnsAddDays(nextDate, 14);
  } else if (frequency === 'every_4_weeks') {
    nextDate = dfnsAddDays(nextDate, 28);
  } else if (frequency === 'custom' && customIntervalDays !== undefined) {
    nextDate = dfnsAddDays(nextDate, customIntervalDays);
  } else if (frequency === 'yearly') {
    nextDate = dfnsAddMonths(nextDate, 12);
  }
  
  return toCalendarDate(nextDate);
}

export function startOfMonth(date: string): string {
  return toCalendarDate(dfnsStartOfMonth(parseISO(date)));
}

export function endOfMonth(date: string): string {
  return toCalendarDate(dfnsEndOfMonth(parseISO(date)));
}
