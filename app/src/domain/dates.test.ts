import { describe, expect, it } from 'vitest';
import { addDays, todayStr, weekOf } from './dates';

describe('dates', () => {
  it('runs in IST (vite.config sets TZ)', () => {
    expect(new Date(2026, 10, 2).getTimezoneOffset()).toBe(-330);
  });

  it('uses the local calendar day, not UTC', () => {
    // 00:30 local on 2 Nov. In IST that is 1 Nov 19:00 UTC, which v1 logged as 1 Nov.
    expect(todayStr(new Date(2026, 10, 2, 0, 30))).toBe('2026-11-02');
    expect(new Date(2026, 10, 2, 0, 30).toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(todayStr(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('returns a Monday-first week', () => {
    // 2026-11-02 is a Monday; 2026-11-08 a Sunday.
    expect(weekOf('2026-11-02')[0]).toBe('2026-11-02');
    expect(weekOf('2026-11-08')).toEqual([
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
    ]);
  });
});
