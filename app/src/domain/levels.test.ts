import { describe, expect, it } from 'vitest';
import { expForLevel, levelFor, MAX_LEVEL, tierForLevel, titleFor } from './levels';

describe('levels', () => {
  it('starts at level 1 with 0 EXP', () => {
    expect(expForLevel(1)).toBe(0);
    expect(levelFor(0)).toBe(1);
  });

  it('inverts expForLevel', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(levelFor(expForLevel(l))).toBe(l);
      if (l > 1) expect(levelFor(expForLevel(l) - 1)).toBe(l - 1);
    }
    expect(levelFor(1e9)).toBe(MAX_LEVEL);
  });

  it('takes weeks, not days, to reach D-rank at ~180 EXP a day', () => {
    const days = expForLevel(10) / 180;
    expect(days).toBeGreaterThan(20);
    expect(days).toBeLessThan(35);
  });

  it('maps levels to rank bands and titles', () => {
    expect(tierForLevel(9)).toBe(0);
    expect(tierForLevel(10)).toBe(1);
    expect(tierForLevel(70)).toBe(5);
    expect(titleFor(1).title).toBe('Weakling');
    expect(titleFor(36).rank).toBe('B');
  });
});
