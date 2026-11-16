import { describe, expect, it } from 'vitest';
import { DEFAULT_REMINDERS, plan } from './reminders';

const ctx = { today: '2026-11-13', todayDone: false, streak: 5, penaltyToday: false };

describe('reminder plan', () => {
  it('schedules a morning and evening reminder per day, skipping times already passed', () => {
    const items = plan(DEFAULT_REMINDERS, ctx, new Date('2026-11-13T12:00:00'));
    expect(items[0]!.title).toBe('[WARNING] QUEST INCOMPLETE');
    expect(items[0]!.body).toMatch(/5/);
    expect(items).toHaveLength(1 + 13 * 2);
  });

  it('drops tonight\'s warning once today is cleared', () => {
    const items = plan(DEFAULT_REMINDERS, { ...ctx, todayDone: true }, new Date('2026-11-13T07:00:00'));
    expect(items.filter((i) => i.at.getDate() === 13).map((i) => i.title)).toEqual(['[DAILY QUEST HAS ARRIVED]']);
  });

  it('warns about the penalty zone in the morning', () => {
    const items = plan(DEFAULT_REMINDERS, { ...ctx, penaltyToday: true }, new Date('2026-11-13T06:00:00'));
    expect(items[0]!.title).toBe('⚠ [PENALTY ZONE]');
  });

  it('varies the wording from day to day', () => {
    const bodies = new Set(plan(DEFAULT_REMINDERS, { ...ctx, streak: 0 }, new Date('2026-11-13T06:00:00')).filter((i) => i.title.includes('ARRIVED')).map((i) => i.body));
    expect(bodies.size).toBeGreaterThan(2);
  });

  it('schedules nothing when off, and ids stay unique', () => {
    expect(plan({ ...DEFAULT_REMINDERS, enabled: false }, ctx, new Date())).toEqual([]);
    const ids = plan(DEFAULT_REMINDERS, ctx, new Date('2026-11-13T06:00:00')).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
