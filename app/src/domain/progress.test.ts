import { describe, expect, it } from 'vitest';
import { countCleared, getMonthly, getRank, getStreak, isPenalty } from './progress';
import { logsFrom } from './testUtils';

const today = '2026-11-02';

describe('countCleared / getRank', () => {
  it('counts only cleared days, not every saved log', () => {
    expect(countCleared(logsFrom({ '2026-11-01': 'x', '2026-10-31': '-', '2026-10-30': 'x' }))).toBe(2);
    expect(countCleared({ '2026-11-01': {} })).toBe(0);
  });

  it('maps totals to rank tiers and progress', () => {
    expect(getRank(0)).toMatchObject({ rank: 'E', level: 1, prog: 0 });
    expect(getRank(10)).toMatchObject({ rank: 'E', level: 5, prog: 50 });
    expect(getRank(15)).toMatchObject({ rank: 'D', level: 10 });
    expect(getRank(500)).toMatchObject({ level: 100, next: null, prog: 100 });
  });
});

describe('getStreak', () => {
  it('counts back from today when today is cleared', () => {
    expect(getStreak(logsFrom({ '2026-10-31': 'x', '2026-11-01': 'x', '2026-11-02': 'x' }), today)).toBe(3);
  });

  it('keeps yesterday\'s streak while today is still open (v1 showed 0)', () => {
    expect(getStreak(logsFrom({ '2026-10-31': 'x', '2026-11-01': 'x' }), today)).toBe(2);
    expect(getStreak(logsFrom({ '2026-11-01': 'x', '2026-11-02': '-' }), today)).toBe(1);
  });

  it('stops at a gap or a missed day', () => {
    expect(getStreak(logsFrom({ '2026-10-30': 'x', '2026-11-01': 'x' }), today)).toBe(1);
    expect(getStreak(logsFrom({ '2026-10-31': '-', '2026-11-01': 'x' }), today)).toBe(1);
    expect(getStreak({}, today)).toBe(0);
  });

  it('counts across a month boundary', () => {
    expect(getStreak(logsFrom({ '2026-10-30': 'x', '2026-10-31': 'x', '2026-11-01': 'x' }), today)).toBe(3);
  });
});

describe('isPenalty', () => {
  it('is off for a new user', () => {
    expect(isPenalty({}, today)).toBe(false);
  });

  it('is off when yesterday was cleared', () => {
    expect(isPenalty(logsFrom({ '2026-11-01': 'x' }), today)).toBe(false);
  });

  it('triggers when yesterday was missed', () => {
    expect(isPenalty(logsFrom({ '2026-11-01': '-' }), today)).toBe(true);
  });

  it('triggers when days were skipped entirely', () => {
    expect(isPenalty(logsFrom({ '2026-10-30': 'x' }), today)).toBe(true);
  });

  it('stays on today until the penalty attempt is cleared', () => {
    const logs = { ...logsFrom({ '2026-11-01': '-' }), [today]: { penaltyAttempt: true } };
    expect(isPenalty(logs, today)).toBe(true);
  });
});

describe('getMonthly', () => {
  it('counts cleared days in the current month only', () => {
    const logs = logsFrom({ '2026-10-31': 'x', '2026-11-01': 'x', '2026-11-02': '-' });
    expect(getMonthly(logs, today)).toEqual({ done: 1, target: 30, unlocked: false });
  });
});
