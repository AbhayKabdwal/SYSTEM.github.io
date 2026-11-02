import { describe, expect, it } from 'vitest';
import { fatigueBand, getFatigue } from './fatigue';
import { logsFrom } from './testUtils';

describe('getFatigue (v1 compliance metric)', () => {
  it('is 0 with no logs or all cleared', () => {
    expect(getFatigue({})).toBe(0);
    expect(getFatigue(logsFrom({ '2026-11-01': 'x', '2026-11-02': 'x' }))).toBe(0);
  });

  it('scales missed share to 0–60', () => {
    expect(getFatigue(logsFrom({ '2026-11-01': '-', '2026-11-02': '-' }))).toBe(60);
    expect(getFatigue(logsFrom({ '2026-11-01': '-', '2026-11-02': 'x' }))).toBe(30);
  });

  it('only looks at the 7 most recent logged days', () => {
    const old = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`2026-10-0${i + 1}`, '-' as const]));
    const recent = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`2026-11-0${i + 1}`, 'x' as const]));
    expect(getFatigue(logsFrom({ ...old, ...recent }))).toBe(0);
  });

  it("doesn't count today's unfinished quest as a miss", () => {
    const logs = logsFrom({ '2026-11-01': 'x', '2026-11-02': '-' });
    expect(getFatigue(logs)).toBe(30);
    expect(getFatigue(logs, '2026-11-02')).toBe(0);
    expect(getFatigue(logsFrom({ '2026-11-01': '-', '2026-11-02': '-' }), '2026-11-01')).toBe(60);
  });

  it('bands values', () => {
    expect(fatigueBand(10)).toBe('optimal');
    expect(fatigueBand(25)).toBe('moderate');
    expect(fatigueBand(45)).toBe('deload');
  });
});
