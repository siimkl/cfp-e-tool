import { format, parseISO } from 'date-fns';
export { isPast, isNew, primaryDate } from '../../shared/core.js';
export function todayInTallinn(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function displayDate(date: string | null): string {
  return date ? format(parseISO(date), 'd MMM yyyy') : 'Date to be announced';
}
export function dateRange(start: string | null, end: string | null): string {
  if (!start) return 'Date to be announced';
  if (!end || end === start) return displayDate(start);
  if (start.slice(0, 7) === end.slice(0, 7))
    return format(parseISO(start), 'd') + '–' + displayDate(end);
  return displayDate(start) + ' – ' + displayDate(end);
}
