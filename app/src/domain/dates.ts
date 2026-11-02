import type { DateStr } from './types';

// All dates are the user's *local* calendar day. v1 used toISOString(), which is UTC,
// so in IST anything logged between 00:00 and 05:30 landed on the previous day.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(now: Date = new Date()): DateStr {
  return toDateStr(now);
}

/** Noon avoids DST edges shifting the day when doing arithmetic. */
export function parseDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Monday-first week containing `s`. */
export function weekOf(s: DateStr): DateStr[] {
  const dow = parseDateStr(s).getDay();
  const start = addDays(s, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
