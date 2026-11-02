import { describe, expect, it } from 'vitest';
import { dayExp, EXP, streakBefore, totalExp } from './exp';
import { DEFAULT_TEMPLATES } from './defaults';
import { cleared, logsFrom, missed } from './testUtils';

describe('dayExp', () => {
  it('rewards a cleared quest plus streak', () => {
    expect(dayExp(cleared(), [], 0)).toMatchObject({ quest: 100, streak: 10, total: 110 });
    expect(dayExp(cleared(), [], 20).streak).toBe(EXP.streakCap);
  });

  it('gives nothing for a missed quest without training', () => {
    expect(dayExp(missed(), [], 5).total).toBe(0);
  });

  it('adds a penalty-clear bonus', () => {
    expect(dayExp({ ...cleared(), penaltyAttempt: true }, [], 0).penalty).toBe(EXP.penaltyBonus);
  });

  it('pays per logged set, capped, and ignores empty sets', () => {
    const sets = Array.from({ length: 50 }, () => ({ v: 60, reps: 8 }));
    const log = { ...missed(), templateId: 'tpl_chest', exLogs: { e_bpress: { sets: [...sets, {}] } } };
    expect(dayExp(log, DEFAULT_TEMPLATES, 0).training).toBe(EXP.trainingCap);
    const two = { ...missed(), templateId: 'tpl_chest', exLogs: { e_bpress: { sets: [{ v: 60, reps: 8 }, { v: '', reps: '' }] } } };
    expect(dayExp(two, DEFAULT_TEMPLATES, 0).training).toBe(EXP.perSet);
  });
});

describe('totalExp', () => {
  it('replays streaks in date order and resets on gaps', () => {
    // 10/30 x, 10/31 x, 11/01 gap, 11/02 x
    const logs = logsFrom({ '2026-10-31': 'x', '2026-10-30': 'x', '2026-11-02': 'x' });
    expect(totalExp(logs, [])).toBe(110 + 120 + 110);
  });

  it('resets the streak after a missed day', () => {
    const logs = logsFrom({ '2026-10-30': 'x', '2026-10-31': '-', '2026-11-01': 'x' });
    expect(totalExp(logs, [])).toBe(110 + 0 + 110);
  });
});

describe('streakBefore', () => {
  it('counts cleared days ending the day before', () => {
    expect(streakBefore(logsFrom({ '2026-10-31': 'x', '2026-11-01': 'x' }), '2026-11-02')).toBe(2);
    expect(streakBefore(logsFrom({ '2026-10-31': 'x' }), '2026-11-02')).toBe(0);
  });
});
