import { describe, expect, it } from 'vitest';
import { DEFAULT_QUEST_POOL, PENALTY_QUEST, RECOVERY_QUEST } from './defaults';
import { isComplete } from './completion';
import { dailyQuest, dungeonQuest, questForDate, randomGate, trialQuest } from './quests';
import { libraryExercise, type Tier } from './library';
import { buildPool, DEFAULT_PREFS } from './prefs';
import type { Preferences } from './types';
import { addDays } from './dates';
import { QUEST, cleared, logsFrom, missed } from './testUtils';

const ids = (date: string) => randomGate(date, DEFAULT_QUEST_POOL).tasks.map((t) => t.id).join(',');

describe('isComplete', () => {
  it('needs every task at or above target', () => {
    expect(isComplete(cleared())).toBe(true);
    expect(isComplete(missed())).toBe(false);
  });

  it('does not count a log without a quest (v1 did)', () => {
    expect(isComplete({})).toBe(false);
    expect(isComplete({ dailyQuest: { ...QUEST, tasks: [] } })).toBe(false);
    expect(isComplete(undefined)).toBe(false);
  });

  it('accepts string progress values from inputs', () => {
    expect(isComplete({ dailyQuest: QUEST, questProgress: { pushups: '100', squats: '100' } })).toBe(true);
  });
});

describe('randomGate', () => {
  it('is deterministic for a date', () => {
    expect(ids('2026-11-02')).toBe(ids('2026-11-02'));
  });

  it('picks 3 distinct tasks from the pool', () => {
    const tasks = randomGate('2026-11-02', DEFAULT_QUEST_POOL).tasks;
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(3);
  });

  it('gives anagram dates different quests (v1 seed collision)', () => {
    expect(ids('2026-11-02')).not.toBe(ids('2026-11-20'));
  });

  it('varies widely over a year', () => {
    const seen = new Set(Array.from({ length: 365 }, (_, i) => ids(addDays('2026-01-01', i))));
    // 9 choose 3 ordered = 504 possible; v1 produced only ~40 distinct seeds a year.
    expect(seen.size).toBeGreaterThan(200);
  });

  it('falls back to the default pool when the custom pool is too small', () => {
    const tasks = randomGate('2026-11-02', [DEFAULT_QUEST_POOL[0]!]).tasks;
    expect(tasks).toHaveLength(3);
  });
});

describe('questForDate', () => {
  const today = '2026-11-02';
  const tired = logsFrom({ '2026-10-30': '-', '2026-10-31': '-', '2026-11-01': '-' });

  it('serves the penalty quest when penalised and not fatigued', () => {
    expect(questForDate(today, { today, penalty: true, logs: logsFrom({ '2026-11-01': 'x' }) })).toBe(PENALTY_QUEST);
  });

  it('switches to recovery when fatigued, penalised or not', () => {
    expect(questForDate(today, { today, penalty: true, logs: tired })).toBe(RECOVERY_QUEST);
    expect(questForDate(today, { today, logs: tired })).toBe(RECOVERY_QUEST);
  });

  it('only applies the deload override to today', () => {
    expect(questForDate('2026-11-03', { today, logs: tired }).name).toBe('DAILY QUEST: RANDOM GATE');
  });

  it('uses the calibrated library once prefs exist', () => {
    const q = questForDate(today, { today, prefs: PREFS, tier: 2 });
    expect(q.kind).toBe('daily');
    expect(q.name).toContain('C-RANK');
    expect(q.tasks.every((t) => PREFS.pool.includes(t.id))).toBe(true);
  });

  it('scales the penalty quest with rank', () => {
    const e = questForDate(today, { today, penalty: true, prefs: PREFS, tier: 0 });
    const a = questForDate(today, { today, penalty: true, prefs: PREFS, tier: 4 });
    expect(e.kind).toBe('penalty');
    const total = (q: typeof e) => q.tasks.reduce((s, t) => s + t.target, 0);
    expect(total(a)).toBeGreaterThan(total(e));
  });
});

const PREFS: Preferences = { ...DEFAULT_PREFS, pool: buildPool(DEFAULT_PREFS) };
const tierOf = (id: string) => libraryExercise(id)!.tiers;

describe('dailyQuest', () => {
  const ctx = (tier: Tier, over: Partial<Preferences> = {}) => {
    const prefs = { ...PREFS, ...over };
    return { tier, progress: 0, prefs: { ...prefs, pool: over.pool ?? buildPool(prefs) } };
  };

  it('is deterministic per date', () => {
    expect(dailyQuest('2026-11-02', ctx(1))).toEqual(dailyQuest('2026-11-02', ctx(1)));
  });

  it('task count follows the time budget', () => {
    expect(dailyQuest('2026-11-02', ctx(0, { minutes: 15 })).tasks).toHaveLength(3);
    expect(dailyQuest('2026-11-02', ctx(0, { minutes: 60 })).tasks).toHaveLength(6);
  });

  it('uses easier variations at low rank and harder ones higher up', () => {
    for (let i = 0; i < 20; i++) {
      const d = addDays('2026-11-01', i);
      for (const t of dailyQuest(d, ctx(0)).tasks) expect(tierOf(t.id)[0]).toBe(0);
      for (const t of dailyQuest(d, ctx(5)).tasks) expect(tierOf(t.id)[1]).toBeGreaterThanOrEqual(2);
    }
  });

  it('grows volume through a rank', () => {
    const sum = (p: number) => dailyQuest('2026-11-02', { ...ctx(1), progress: p }).tasks.reduce((s, t) => s + t.target, 0);
    expect(sum(1)).toBeGreaterThan(sum(0));
  });

  it('respects equipment and limitations', () => {
    for (let i = 0; i < 30; i++) {
      const q = dailyQuest(addDays('2026-11-01', i), ctx(3, { limits: ['knees'], equipment: [] }));
      for (const t of q.tasks) {
        const ex = libraryExercise(t.id)!;
        expect(ex.avoid ?? []).not.toContain('knees');
        expect(ex.equip).toBeUndefined();
      }
    }
  });

  it('rotates away from yesterday\'s patterns', () => {
    let repeats = 0;
    for (let i = 0; i < 40; i++) {
      const d = addDays('2026-11-01', i);
      const y = dailyQuest(addDays(d, -1), ctx(1, { minutes: 15 }));
      const t = dailyQuest(d, { ...ctx(1, { minutes: 15 }), yesterday: y });
      repeats += t.tasks.filter((x) => y.tasks.some((z) => z.pattern === x.pattern)).length;
    }
    // Without rotation about half of 120 tasks would repeat a pattern.
    expect(repeats).toBeLessThan(45);
  });
});

describe('trial and dungeon', () => {
  it('tests the next rank at higher volume than a normal day', () => {
    const trial = trialQuest(1, PREFS);
    expect(trial.kind).toBe('trial');
    expect(trial.name).toContain('D-RANK');
    expect(trial.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it('gives one dungeon per week', () => {
    const c = { tier: 1 as Tier, progress: 0, prefs: PREFS };
    expect(dungeonQuest('2026-11-02', c)).toEqual(dungeonQuest('2026-11-02', c));
    expect(dungeonQuest('2026-11-02', c).tasks).toHaveLength(5);
  });
});
