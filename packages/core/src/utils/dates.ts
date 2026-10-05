/**
 * Calendar dates are plain `YYYY-MM-DD` strings in every database, which compare
 * correctly as text. Date objects below are always UTC midnight.
 */

const DAY_MS = 86_400_000;

export const parseDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

export const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

/** Today's calendar date (UTC). */
export const todayDateOnly = (now = new Date()): string => formatDateOnly(now);

export const addDays = (date: string, days: number): string =>
  formatDateOnly(new Date(parseDateOnly(date).getTime() + days * DAY_MS));

/** Whole days from `from` to `to` (positive when `to` is later). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((parseDateOnly(to).getTime() - parseDateOnly(from).getTime()) / DAY_MS);

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Half-open range [start, end) for a calendar month (month is 1-12). */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

/** Half-open range of `YYYY-MM-DD` strings for a calendar month. */
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const { start, end } = monthRange(year, month);
  return { start: formatDateOnly(start), end: formatDateOnly(end) };
}

export function currentYearMonth(now = new Date()): { year: number; month: number } {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** Year and month of a `YYYY-MM-DD` string. */
export const yearMonthOf = (date: string): { year: number; month: number } => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
});

/** Shift a year/month pair by `delta` months. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const monthKey = (year: number, month: number): string => `${year}-${String(month).padStart(2, '0')}`;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const monthName = (month: number): string => MONTH_NAMES[month - 1];

/** Current timestamp as an ISO string — how timestamps are stored and returned. */
export const nowIso = (now = new Date()): string => now.toISOString();
