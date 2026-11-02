import { describe, expect, it } from 'vitest';
import { computeLedger, EXP, multiplier, restAvailable } from './ledger';
import { addDays } from './dates';
import { expForLevel } from './levels';
import { trialQuest } from './quests';
import { buildPool, DEFAULT_PREFS } from './prefs';
import { QUEST, cleared, missed } from './testUtils';
import type { DailyLog, Logs, Player } from './types';

const V2: Player = { name: 'A', rulesSince: '2026-10-01' };
const LEGACY: Player = { name: 'A' };
const proofOn = (date: string) => ({ photoId: 'p', at: new Date(`${date}T10:00:00`).toISOString(), visibility: 'private' as const });
const done = (date: string, extra: Partial<DailyLog> = {}): DailyLog => ({ ...cleared(), proof: proofOn(date), ...extra });

/** `x` verified clear, `u` cleared without proof, `r` rest, `-` missed (empty log), `p` penalty quest cleared. */
function run(start: string, spec: string, player = V2): Logs {
  const logs: Logs = {};
  [...spec].forEach((c, i) => {
    const d = addDays(start, i);
    if (c === 'x') logs[d] = done(d);
    if (c === 'u') logs[d] = cleared();
    if (c === 'r') logs[d] = { rest: true };
    if (c === '-') logs[d] = missed();
    if (c === 'p') logs[d] = done(d, { penaltyAttempt: true });
  });
  void player;
  return logs;
}

const MON = '2026-10-05';
const ledger = (logs: Logs, today: string, player = V2) => computeLedger(logs, [], player, today);
const at = (spec: string, player = V2) => ledger(run(MON, spec, player), addDays(MON, spec.length - 1), player);

describe('streaks', () => {
  it('counts verified clears', () => {
    const l = at('xxx');
    expect(l.streak).toBe(3);
    expect(l.chain).toBe(3);
  });

  it('holds the streak but halves EXP without proof', () => {
    const l = at('xxu');
    expect(l.streak).toBe(2);
    expect(l.chain).toBe(0);
    const day = l.days[addDays(MON, 2)]!;
    expect(day.status).toBe('unverified');
    expect(day.quest).toBe(Math.round((EXP.questBase + EXP.perTask * QUEST.tasks.length) * EXP.unverifiedShare));
    expect(day.mult).toBe(1);
  });

  it('only counts proof taken on the day itself', () => {
    const d = addDays(MON, 1);
    const logs = { [MON]: done(MON), [d]: { ...cleared(), proof: proofOn(addDays(d, 1)) } };
    expect(ledger(logs, addDays(d, 1)).days[d]!.status).toBe('unverified');
  });

  it('a rest day keeps the streak and resets momentum', () => {
    const l = at('xxrx');
    expect(l.days[addDays(MON, 2)]!.status).toBe('rest');
    expect(l.streak).toBe(3);
    expect(l.chain).toBe(1);
  });

  it('allows one rest day per Monday–Sunday week', () => {
    const l = at('rrx');
    expect(l.days[MON]!.status).toBe('rest');
    expect(l.days[addDays(MON, 1)]!.status).toBe('missed');
    // Next week gets a fresh one.
    expect(at('xxxxxxxr').days[addDays(MON, 7)]!.status).toBe('rest');
  });

  it('rewards not resting: same days cleared, more EXP without the rest day', () => {
    const noRest = at('xxxxxxx');
    const withRest = at('xxxrxxx');
    expect(noRest.exp).toBeGreaterThan(withRest.exp);
    expect(multiplier(10, 10)).toBeGreaterThan(multiplier(10, 2));
  });
});

describe('penalties', () => {
  it('a missed day costs EXP, breaks the streak and triggers the penalty zone', () => {
    const logs = run(MON, 'xxxxx-');
    const l = ledger(logs, addDays(MON, 6));
    const miss = l.days[addDays(MON, 5)]!;
    expect(miss.status).toBe('missed');
    expect(miss.penalty).toBe(EXP.missBase);
    expect(l.streak).toBe(0);
    expect(l.penaltyToday).toBe(true);
    expect(l.repairableStreak).toBe(5);
  });

  it('clearing the penalty quest the next day restores the streak', () => {
    const l = at('xxxxx-p');
    expect(l.days[addDays(MON, 6)]!.restored).toBe(true);
    expect(l.streak).toBe(6);
    expect(l.chain).toBe(1);
    expect(l.events.some((e) => e.kind === 'restore')).toBe(true);
  });

  it('a gap with no log at all counts as missed', () => {
    const logs = { [MON]: done(MON), [addDays(MON, 2)]: done(addDays(MON, 2)) };
    expect(ledger(logs, addDays(MON, 2)).days[addDays(MON, 1)]!.status).toBe('missed');
  });

  it('today is open, not missed, until it ends', () => {
    const l = ledger(run(MON, 'xx'), addDays(MON, 2));
    expect(l.days[addDays(MON, 2)]!.status).toBe('open');
    expect(l.streak).toBe(2);
    expect(l.penaltyToday).toBe(false);
  });

  it('never drops EXP below the start of the current level', () => {
    const l = at('x-------');
    expect(l.exp).toBeGreaterThanOrEqual(expForLevel(l.level));
  });

  it('does not penalise history from before the v2 rules', () => {
    const l = at('x-xu', LEGACY);
    expect(l.days[addDays(MON, 1)]!.penalty).toBe(0);
    expect(l.days[addDays(MON, 3)]!.status).toBe('verified');
  });
});

describe('bonuses', () => {
  it('pays streak milestones once', () => {
    const l = at('xxx');
    expect(l.days[addDays(MON, 2)]!.bonus).toBe(EXP.milestonePerDay * 3);
    expect(at('xxx-pxx').events.filter((e) => e.kind === 'milestone')).toHaveLength(1);
  });

  it('pays a perfect week for 7 verified clears Monday to Sunday', () => {
    expect(at('xxxxxxx').perfectWeeks).toBe(1);
    expect(at('xxxuxxx').perfectWeeks).toBe(0);
    expect(at('xxxrxxx').perfectWeeks).toBe(0);
  });

  it('counts the weekly dungeon once', () => {
    const d1 = MON;
    const d2 = addDays(MON, 1);
    const side = { dungeon: { quest: QUEST, progress: { pushups: 100, squats: 100 } } };
    const l = ledger({ [d1]: done(d1, { side }), [d2]: done(d2, { side }) }, d2);
    expect(l.dungeonWeeks.size).toBe(1);
    expect(l.days[d2]!.side).toBe(0);
  });
});

describe('rank trials', () => {
  const prefs = { ...DEFAULT_PREFS, pool: buildPool(DEFAULT_PREFS) };
  const trial = trialQuest(1, prefs);
  const full = Object.fromEntries(trial.tasks.map((t) => [t.id, t.target]));

  it('needs the level first', () => {
    const l = ledger({ [MON]: done(MON, { side: { trial: { quest: trial, progress: full, rank: 'D' } } }) }, MON);
    expect(l.tier).toBe(0);
    expect(l.trialReady).toBe(false);
  });

  it('promotes once the level is reached and the trial is cleared', () => {
    const logs = run(MON, 'x'.repeat(40));
    const last = addDays(MON, 39);
    const before = ledger(logs, last);
    expect(before.level).toBeGreaterThanOrEqual(10);
    expect(before.tier).toBe(0);
    expect(before.trialReady).toBe(true);
    logs[last] = { ...logs[last]!, side: { trial: { quest: trial, progress: full, rank: 'D' } } };
    const after = ledger(logs, last);
    expect(after.tier).toBe(1);
    expect(after.rank).toBe('D');
    expect(after.exp).toBeGreaterThan(before.exp);
  });
});

describe('trial on the day you level up', () => {
  it('still promotes', () => {
    const prefs = { ...DEFAULT_PREFS, pool: buildPool(DEFAULT_PREFS) };
    const trial = trialQuest(1, prefs);
    const full = Object.fromEntries(trial.tasks.map((t) => [t.id, t.target]));
    const logs = run(MON, 'x'.repeat(60));
    const dates = Object.keys(logs).sort();
    const base = ledger(logs, dates[dates.length - 1]!);
    // First day whose EXP crosses level 10.
    const day = dates.find((d) => base.days[d] && ledger(logs, d).level >= 10 && ledger(logs, addDays(d, -1)).level < 10)!;
    logs[day] = { ...logs[day]!, side: { trial: { quest: trial, progress: full, rank: 'D' } } };
    expect(ledger(logs, day).tier).toBe(1);
  });
});

describe('restAvailable', () => {
  it('is free until used this week', () => {
    expect(restAvailable(at('xx'), addDays(MON, 2))).toBe(true);
    expect(restAvailable(at('rx'), addDays(MON, 2))).toBe(false);
  });
});
