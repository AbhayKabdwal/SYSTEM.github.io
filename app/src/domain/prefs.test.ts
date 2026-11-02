import { describe, expect, it } from 'vitest';
import { buildPool, DEFAULT_PREFS, fits } from './prefs';
import { LIBRARY, libraryExercise, QUEST_PATTERNS } from './library';

describe('buildPool', () => {
  it('covers every quest pattern with no equipment', () => {
    const pool = buildPool(DEFAULT_PREFS).map((id) => libraryExercise(id)!);
    for (const p of QUEST_PATTERNS) expect(pool.some((e) => e.pattern === p), p).toBe(true);
  });

  it('adds equipment exercises only when you have the equipment', () => {
    expect(buildPool(DEFAULT_PREFS)).not.toContain('pullup');
    expect(buildPool({ ...DEFAULT_PREFS, equipment: ['pullup_bar'] })).toContain('pullup');
    expect(buildPool({ ...DEFAULT_PREFS, goals: ['muscle'], equipment: ['gym'] })).toContain('db_row');
  });

  it('leaves out exercises that stress a flagged joint', () => {
    const pool = buildPool({ ...DEFAULT_PREFS, goals: ['fat_loss'], limits: ['knees'] });
    expect(pool).not.toContain('burpees');
    expect(pool).not.toContain('jog');
  });

  it('follows goals', () => {
    const endurance = buildPool({ ...DEFAULT_PREFS, goals: ['endurance'] });
    expect(endurance).toContain('jog');
    expect(buildPool({ ...DEFAULT_PREFS, goals: ['strength'] })).not.toContain('situp');
    expect(buildPool({ ...DEFAULT_PREFS, goals: ['fat_loss'] })).toContain('situp');
  });
});

describe('library', () => {
  it('has a target for every tier in each range and sane hard sets', () => {
    for (const e of LIBRARY) {
      for (let t = e.tiers[0]; t <= e.tiers[1]; t++) expect(e.targets[t], `${e.id} tier ${t}`).toBeGreaterThan(0);
      expect(e.hardSet).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
  });

  it('gym covers bar and dumbbell exercises but not a jump rope', () => {
    expect(fits(libraryExercise('pullup')!, { equipment: ['gym'], limits: [] })).toBe(true);
    expect(fits(libraryExercise('jump_rope')!, { equipment: ['gym'], limits: [] })).toBe(false);
  });
});
