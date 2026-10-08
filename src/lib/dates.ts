import { format, parseISO } from 'date-fns';
import { et } from 'date-fns/locale';
import type { Item } from '../types';
export { isPast, isNew, primaryDate } from '../../shared/core.js';
export type AddedPeriod =
  'all' | 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'last30';

export function matchesAddedPeriod(
  createdAt: string,
  period: AddedPeriod,
  today: string,
): boolean {
  if (period === 'all') return true;
  const added = todayInTallinn(new Date(createdAt));
  const current = new Date(today + 'T00:00:00Z');
  const daysBack = (days: number) =>
    new Date(current.getTime() - days * 86400000).toISOString().slice(0, 10);
  if (period === 'today') return added === today;
  if (period === 'yesterday') return added === daysBack(1);
  // Calendar periods follow Tallinn dates, with Monday as the start of the week.
  const start =
    period === 'week'
      ? daysBack((current.getUTCDay() + 6) % 7)
      : period === 'month'
        ? today.slice(0, 7) + '-01'
        : daysBack(period === 'last7' ? 6 : 29);
  return added >= start && added <= today;
}
export function todayInTallinn(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function displayDate(date: string | null): string {
  return date
    ? format(parseISO(date), 'd. MMM yyyy', { locale: et })
    : 'Kuupäev täpsustamisel';
}
export function dateRange(start: string | null, end: string | null): string {
  if (!start) return 'Kuupäev täpsustamisel';
  if (!end || end === start) return displayDate(start);
  if (start.slice(0, 7) === end.slice(0, 7))
    return format(parseISO(start), 'd') + '–' + displayDate(end);
  return displayDate(start) + ' – ' + displayDate(end);
}

export function dateStatus(item: Item, today: string) {
  const start = item.item_type === 'CFP' ? item.deadline : item.event_start;
  const end =
    item.item_type === 'CFP' ? item.deadline : item.event_end || start;
  // Compare calendar days at UTC midnight, independent of daylight saving time.
  const daysUntil = (date: string) =>
    Math.round(
      (Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) /
        86400000,
    );
  if (end && end < today) {
    const days = -daysUntil(end);
    return {
      tone: 'past',
      label: `Möödunud · ${days} ${days === 1 ? 'päev' : 'päeva'} tagasi`,
    };
  }
  if (!start) return { tone: 'unknown', label: 'Kuupäev täpsustamisel' };
  if (item.item_type === 'EVENT' && start <= today && end && end >= today) {
    const days = daysUntil(end);
    return {
      tone: 'active',
      label:
        days === 0
          ? 'Käimas · lõpeb täna'
          : `Käimas · lõpuni ${days} ${days === 1 ? 'päev' : 'päeva'}`,
    };
  }
  const days = daysUntil(start);
  return {
    tone: days <= 7 ? 'urgent' : days <= 30 ? 'soon' : 'later',
    label:
      days === 0
        ? 'Tähtaeg täna'
        : `${days} ${days === 1 ? 'päev' : 'päeva'} ${item.item_type === 'CFP' ? 'tähtajani' : 'alguseni'}`,
  };
}
