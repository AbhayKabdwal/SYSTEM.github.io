import { describe, expect, it } from 'vitest';
import { DEFAULT_QUEST_POOL, PENALTY_QUEST, RECOVERY_QUEST } from './defaults';
import { isComplete } from './completion';
import { questForDate, randomGate } from './quests';
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
});
