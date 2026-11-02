import { describe, expect, it } from 'vitest';
import { bodyFatigue, guessMuscles, logMuscleLoad, muscleFatigue, muscleState, musclesFor, recoveryAdvice, setLoad } from './muscles';
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

describe('setLoad', () => {
  it('scales by unit', () => {
    expect(setLoad('reps', { v: 100 })).toBe(10);
    expect(setLoad('kg', { v: 60, reps: 8 })).toBeCloseTo(3.2);
    expect(setLoad('km', { v: 3 })).toBe(9);
    expect(setLoad('stage', { v: 'Frog Stand', seconds: 30 })).toBe(2);
  });

  it('treats junk as zero', () => {
    expect(setLoad('reps', { v: 'abc' })).toBe(0);
    expect(setLoad('kg', { v: -5, reps: 8 })).toBeCloseTo(0.8);
  });
});

describe('muscleFatigue', () => {
  const pushDay: DailyLog = { dailyQuest: QUEST, questProgress: { pushups: 100, squats: 0 }, savedAt: '2026-11-01T18:00:00+05:30' };

  it('loads the right muscles from quest tasks', () => {
    const load = logMuscleLoad(pushDay, []);
    expect(load.chest).toBe(10);
    expect(load.quads).toBeUndefined();
  });

  it('includes training sets from the chosen template', () => {
    const log: DailyLog = { templateId: 'tpl_chest', exLogs: { e_bpress: { sets: [{ v: 60, reps: 8 }] } } };
    expect(logMuscleLoad(log, DEFAULT_TEMPLATES).chest).toBeCloseTo(3.2);
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

  it('reads one quest task as light load, well short of strained', () => {
    const pct = muscleFatigue({ '2026-11-01': pushDay }, [], at('2026-11-01T19:00:00+05:30')).chest;
    expect(muscleState(pct)).toBe('fresh');
    expect(pct).toBeGreaterThan(15);
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
