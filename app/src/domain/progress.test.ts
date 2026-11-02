import { describe, expect, it } from 'vitest';
import { countCleared, getMonthly } from './progress';
import { logsFrom } from './testUtils';

const today = '2026-11-02';

describe('countCleared', () => {
  it('counts only cleared days, not every saved log', () => {
    expect(countCleared(logsFrom({ '2026-11-01': 'x', '2026-10-31': '-', '2026-10-30': 'x' }))).toBe(2);
    expect(countCleared({ '2026-11-01': {} })).toBe(0);
  });
});

describe('getMonthly', () => {
  it('counts cleared days in the current month only', () => {
    const logs = logsFrom({ '2026-10-31': 'x', '2026-11-01': 'x', '2026-11-02': '-' });
    expect(getMonthly(logs, today)).toEqual({ done: 1, target: 30, unlocked: false });
  });
});
