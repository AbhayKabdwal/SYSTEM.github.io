import { describe, expect, it } from 'vitest';
import { bodyFatigue, dayLoads, EffortModel, guessMuscles, muscleFatigue, muscleState, musclesFor, questTaskHse, recoveryAdvice, rirFactor } from './muscles';
import { DEFAULT_TEMPLATES } from './defaults';
import type { DailyLog, Logs } from './types';
import { QUEST } from './testUtils';

const at = (iso: string) => new Date(iso);

describe('muscle mapping', () => {
  it('guesses muscles from exercise names', () => {
    expect(guessMuscles('Incline Bench Press').chest).toBeGreaterThan(0);
    expect(guessMuscles('Romanian Deadlift').hamstrings).toBe(1);
    expect(guessMuscles('Pull-ups').lats).toBe(1);
    expect(guessMuscles('Underwater basket weaving')).toEqual({});
  });

  it('prefers explicit muscles over the guess', () => {
    expect(musclesFor({ name: 'Bench Press', muscles: { triceps: 1 } })).toEqual({ triceps: 1 });
    expect(musclesFor({ name: 'Bench Press', muscles: {} }).chest).toBe(1);
  });

  it('maps every default exercise to at least one muscle', () => {
    for (const t of DEFAULT_TEMPLATES) for (const ex of t.exercises) expect(Object.keys(musclesFor(ex)), ex.name).not.toHaveLength(0);
  });
});

describe('effort model', () => {
  it('scores sets by reps in reserve', () => {
    expect(rirFactor(0)).toBe(1);
    expect(rirFactor(3)).toBe(1);
    expect(rirFactor(5)).toBeLessThan(rirFactor(4));
    expect(rirFactor(12)).toBe(0.25);
  });

  it('a light set after a heavy one counts for less', () => {
    const m = new EffortModel();
    m.observe('bench', 'kg', { v: 100, reps: 5 });
    expect(m.setHse('bench', 'kg', { v: 100, reps: 5 })).toBe(1);
    expect(m.setHse('bench', 'kg', { v: 50, reps: 5 })).toBeLessThan(0.5);
  });

  it('RPE overrides the estimate', () => {
    const m = new EffortModel();
    m.observe('bench', 'kg', { v: 100, reps: 5 });
    expect(m.setHse('bench', 'kg', { v: 50, reps: 5, rpe: 9 })).toBe(1);
  });

  it('compares bodyweight reps and holds with your best', () => {
    const m = new EffortModel();
    expect(m.setHse('pu', 'reps', { v: 20 })).toBe(1);
    m.observe('pu', 'reps', { v: 20 });
    expect(m.setHse('pu', 'reps', { v: 10 })).toBeLessThan(0.5);
    m.observe('plank', 'sec', { v: 120 });
    expect(m.setHse('plank', 'sec', { v: 110 })).toBe(1);
    expect(m.setHse('plank', 'sec', { v: 30 })).toBeLessThan(0.5);
  });

  it('turns quest totals into hard sets', () => {
    expect(questTaskHse({ id: 'pushup', label: 'Push-ups', target: 45, unit: 'reps' }, 45)).toBe(3);
    expect(questTaskHse({ id: 'x', label: 'X', target: 10, unit: 'reps', hardSet: 5 }, 10)).toBe(2);
    expect(questTaskHse({ id: 'x', label: 'X', target: 10, unit: 'reps' }, 'abc')).toBe(0);
  });
});

describe('muscleFatigue', () => {
  const pushDay: DailyLog = { dailyQuest: QUEST, questProgress: { pushups: 100, squats: 0 }, savedAt: '2026-11-01T18:00:00+05:30' };

  it('loads the right muscles from quest tasks', () => {
    const load = dayLoads({ d: pushDay }, []).d!.muscles;
    expect(load.chest).toBe(5);
    expect(load.quads).toBeUndefined();
  });

  it('includes training sets from the chosen template', () => {
    const log: DailyLog = { templateId: 'tpl_chest', exLogs: { e_bpress: { sets: [{ v: 60, reps: 8 }, { v: 60, reps: 8 }] } } };
    expect(dayLoads({ d: log }, DEFAULT_TEMPLATES).d!.muscles.chest).toBe(2);
  });

  it('a full chest session reads strained, then mostly recovers in three days', () => {
    const sets = Array.from({ length: 4 }, () => ({ v: 60, reps: 8 }));
    const log: DailyLog = { templateId: 'tpl_chest', trainingSavedAt: '2026-11-01T18:00:00+05:30', exLogs: { e_bpress: { sets }, e_ipress: { sets } } };
    const logs: Logs = { '2026-11-01': log };
    const now = muscleFatigue(logs, DEFAULT_TEMPLATES, at('2026-11-01T19:00:00+05:30')).chest;
    expect(muscleState(now)).toMatch(/strained|overloaded/);
    expect(muscleFatigue(logs, DEFAULT_TEMPLATES, at('2026-11-04T18:00:00+05:30')).chest).toBeLessThan(25);
  });

  it('decays over time and stays within 0–100', () => {
    const logs: Logs = { '2026-11-01': pushDay };
    const fresh = muscleFatigue(logs, [], at('2026-11-01T19:00:00+05:30')).chest;
    const later = muscleFatigue(logs, [], at('2026-11-03T18:00:00+05:30')).chest;
    expect(fresh).toBeGreaterThan(later);
    expect(later).toBeGreaterThan(0);
    expect(muscleFatigue(logs, [], at('2026-11-20T18:00:00+05:30')).chest).toBe(0);
  });

  it('ignores logs in the future', () => {
    expect(muscleFatigue({ '2026-11-05': pushDay }, [], at('2026-11-01T12:00:00+05:30')).chest).toBe(0);
  });

  it('reads 100 push-ups as real work, short of overloaded', () => {
    const pct = muscleFatigue({ '2026-11-01': pushDay }, [], at('2026-11-01T19:00:00+05:30')).chest;
    expect(muscleState(pct)).toMatch(/worked|strained/);
  });

  it('saturates under huge load', () => {
    const huge: DailyLog = { ...pushDay, questProgress: { pushups: 5000 } };
    expect(muscleFatigue({ '2026-11-01': huge }, [], at('2026-11-01T19:00:00+05:30')).chest).toBe(100);
  });
});

describe('advice', () => {
  const zero = Object.fromEntries(['chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'lats', 'traps', 'lower_back', 'glutes', 'quads', 'hamstrings', 'calves'].map((m) => [m, 0])) as Parameters<typeof bodyFatigue>[0];

  it('says all clear when nothing is loaded', () => {
    expect(recoveryAdvice(zero)).toMatch(/recovered/);
    expect(bodyFatigue(zero)).toBe(0);
  });

  it('names strained muscles to rest', () => {
    expect(recoveryAdvice({ ...zero, chest: 70, quads: 60 })).toMatch(/^Rest Chest, Quads/);
  });

  it('mentions worked muscles even when none are strained', () => {
    expect(recoveryAdvice({ ...zero, chest: 40 })).toMatch(/Most worked: Chest/);
  });
});
