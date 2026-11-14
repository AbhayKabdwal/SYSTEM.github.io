import { describe, expect, it } from 'vitest';
import { computeLedger, EP, freshnessFactor, questShare } from './ledger';
import { addDays } from './dates';
import { QUEST, cleared, missed } from './testUtils';
import { checkinScale, dailyQuest, dungeonQuest, jobQuest } from './quests';
import { buildPool, DEFAULT_PREFS } from './prefs';
import { newRecords, personalRecords } from './records';
import { weeklyReport } from './report';
import { newUnlocks, isUnlocked } from './unlocks';
import { loreUnlocked } from './lore';
import { bossFor, bossHp, monthDamage } from './boss';
import { shadowName } from './army';
import { DEFAULT_TEMPLATES } from './defaults';
import type { DailyLog, Logs, Player, Quest } from './types';

const MON = '2026-10-05';
const V2: Player = { name: 'A', rulesSince: '2026-10-01' };
const proofOn = (date: string) => ({ photoId: 'p', at: new Date(`${date}T10:00:00`).toISOString(), visibility: 'private' as const });
const done = (date: string, extra: Partial<DailyLog> = {}): DailyLog => ({ ...cleared(), proof: proofOn(date), ...extra });

function run(spec: string, start = MON, extra: (d: string, i: number) => Partial<DailyLog> = () => ({})): Logs {
  const logs: Logs = {};
  [...spec].forEach((c, i) => {
    const d = addDays(start, i);
    if (c === 'x') logs[d] = done(d, extra(d, i));
    if (c === 'u') logs[d] = { ...cleared(), ...extra(d, i) };
    if (c === 'r') logs[d] = { rest: true };
    if (c === '-') logs[d] = missed();
  });
  return logs;
}
const L = (logs: Logs, today: string, player: Player = V2) => computeLedger(logs, [], player, today);
const at = (spec: string, player: Player = V2) => L(run(spec), addDays(MON, spec.length - 1), player);
const prefs = { ...DEFAULT_PREFS, pool: buildPool(DEFAULT_PREFS) };

describe('Effort Points (fair competition)', () => {
  it('scores your own quest the same regardless of rank', () => {
    const hard: Quest = { ...QUEST, tier: 5, tasks: QUEST.tasks.map((t) => ({ ...t, target: t.target * 5 })) };
    const e = L({ [MON]: done(MON) }, MON).days[MON]!.ep;
    const s = L({ [MON]: done(MON, { dailyQuest: hard, questProgress: { pushups: 500, squats: 500 } }) }, MON).days[MON]!.ep;
    expect(e).toBe(EP.quest);
    expect(s).toBe(e);
  });

  it('gives partial credit, halves unverified, and caps a day at 100', () => {
    expect(questShare({ dailyQuest: QUEST, questProgress: { pushups: 50, squats: 100 } })).toBe(0.75);
    expect(at('u').days[MON]!.ep).toBe(EP.quest / 2);
    const huge: DailyLog = { ...done(MON), templateId: 'tpl_chest', exLogs: { e_bpress: { sets: Array.from({ length: 40 }, () => ({ v: 60, reps: 8 })) } } };
    expect(computeLedger({ [MON]: huge }, DEFAULT_TEMPLATES, V2, MON).days[MON]!.ep).toBeLessThanOrEqual(EP.dayCap);
  });

  it('training returns diminish: 4x the work is not 4x the points', () => {
    const sets = (n: number): DailyLog => ({ templateId: 'tpl_chest', exLogs: { e_bpress: { sets: Array.from({ length: n }, () => ({ v: 60, reps: 8, rpe: 9 })) } } });
    const ep = (n: number) => computeLedger({ [MON]: sets(n) }, DEFAULT_TEMPLATES, V2, addDays(MON, 1)).days[MON]!.ep;
    expect(ep(12)).toBeLessThan(ep(3) * 3);
  });

  it('training tired muscles counts for less than fresh ones', () => {
    expect(freshnessFactor(10)).toBeGreaterThan(freshnessFactor(90));
    const chest = (): DailyLog => ({ templateId: 'tpl_chest', exLogs: { e_bpress: { sets: Array.from({ length: 6 }, () => ({ v: 60, reps: 8, rpe: 9 })) } } });
    const back = (): DailyLog => ({ templateId: 'tpl_back', exLogs: { e_brow: { sets: Array.from({ length: 6 }, () => ({ v: 60, reps: 8, rpe: 9 })) } } });
    const d2 = addDays(MON, 1);
    const again = computeLedger({ [MON]: chest(), [d2]: chest() }, DEFAULT_TEMPLATES, V2, d2).days[d2]!;
    const switched = computeLedger({ [MON]: chest(), [d2]: back() }, DEFAULT_TEMPLATES, V2, d2).days[d2]!;
    expect(again.fresh).toBeLessThan(switched.fresh);
  });

  it('publishes 14 days of recent effort for groups and duels', () => {
    const l = at('xxr-x');
    expect(l.recentEp).toHaveLength(14);
    expect(l.recentKept.slice(-5)).toEqual([true, true, true, false, true]);
    expect(l.weekEp).toBe(l.recentEp.slice(-5).reduce((a, b) => a + b, 0));
  });
});

describe('items', () => {
  it('a 14-day streak earns a Streak Shield that absorbs the next miss', () => {
    const l = at('x'.repeat(14) + '-x');
    const miss = l.days[addDays(MON, 14)]!;
    expect(miss.status).toBe('shielded');
    expect(miss.penalty).toBe(0);
    expect(l.streak).toBe(15);
    expect(l.inventory.shield).toBe(0);
    expect(l.penaltyToday).toBe(false);
  });

  it('a perfect week drops an EXP Scroll that doubles a day', () => {
    const base = at('xxxxxxxx');
    expect(base.inventory.scroll).toBe(1);
    const d = addDays(MON, 7);
    const logs = run('xxxxxxxx');
    logs[d] = { ...logs[d]!, items: { scroll: true } };
    const used = L(logs, d);
    expect(used.days[d]!.scroll).toBe(true);
    expect(used.inventory.scroll).toBe(0);
    expect(used.days[d]!.total).toBeGreaterThan(base.days[d]!.total * 1.8);
  });

  it('every second dungeon gives a Rest Elixir for a second rest day', () => {
    const side = { dungeon: { quest: QUEST, progress: { pushups: 100, squats: 100 } } };
    const logs = run('xxxxxxx' + 'xxxxxxx' + 'rr', MON, (_d, i) => (i === 0 || i === 7 ? { side } : {}));
    const l = L(logs, addDays(MON, 15));
    expect(l.days[addDays(MON, 15)]!.status).toBe('rest');
    expect(l.inventory.elixir).toBe(0);
  });
});

describe('shadow army', () => {
  it('perfect weeks extract shadows; a week with a miss wounds one; the next perfect week heals', () => {
    let l = at('xxxxxxx');
    expect(l.shadows).toHaveLength(1);
    l = at('xxxxxxx' + 'xx-xxxx');
    expect(l.shadows[0]!.wounded).toBe(true);
    l = at('xxxxxxx' + 'xx-xxxx' + 'xxxxxxx');
    expect(l.shadows.every((s) => !s.wounded)).toBe(true);
    expect(l.shadows).toHaveLength(2);
    expect(shadowName('a')).toBe(shadowName('a'));
  });
});

describe('dungeon break', () => {
  it('skipping a week’s dungeon makes the next one a break that pays more', () => {
    const logs = run('x'.repeat(60));
    const ledgerBefore = L(logs, addDays(MON, 59));
    expect(ledgerBefore.level).toBeGreaterThanOrEqual(4);
    expect(ledgerBefore.dungeonBreak).toBe(true);
    const ctx = { tier: 0 as const, progress: 0, prefs };
    const normal = dungeonQuest(MON, ctx);
    const broke = dungeonQuest(MON, ctx, true);
    expect(broke.name).toMatch(/^DUNGEON BREAK/);
    expect(broke.tasks.reduce((s, t) => s + t.target, 0)).toBeGreaterThan(normal.tasks.reduce((s, t) => s + t.target, 0));
  });
});

describe('stats and job change', () => {
  it('3 stat points per level, spent points add to stats', () => {
    const logs = run('x'.repeat(10));
    const free = L(logs, addDays(MON, 9));
    expect(free.statPoints.total).toBe((free.level - 1) * 3);
    const spent = L(logs, addDays(MON, 9), { ...V2, statAlloc: { str: 2 } });
    expect(spent.stats.str).toBe(free.stats.str + 2);
    expect(spent.statPoints.free).toBe(free.statPoints.free - 2);
  });

  it('the job quest needs level 40 and three clears', () => {
    const q = jobQuest(2, prefs);
    const full = Object.fromEntries(q.tasks.map((t) => [t.id, t.target]));
    const l = L({ [MON]: done(MON, { side: { job: { quest: q, progress: full } } }) }, MON);
    expect(l.jobProgress).toBe(0);
  });

  it('class and stat tilts steer quest patterns', () => {
    const count = (tilt: Parameters<typeof dailyQuest>[1]['tilt']) => {
      let cardio = 0;
      for (let i = 0; i < 40; i++) for (const t of dailyQuest(addDays(MON, i), { tier: 1, progress: 0, prefs, tilt }).tasks) if (t.pattern === 'cardio' || t.pattern === 'conditioning') cardio++;
      return cardio;
    };
    expect(count({ jobClass: 'assassin', statAlloc: { agi: 30 } })).toBeGreaterThan(count({ jobClass: 'fighter', statAlloc: { str: 30 } }));
  });
});

describe('check-in', () => {
  it('poor sleep or soreness lightens the quest', () => {
    expect(checkinScale(undefined)).toBe(1);
    expect(checkinScale({ sleep: 8, soreness: 2 })).toBe(1);
    expect(checkinScale({ sleep: 5, soreness: 5 })).toBeLessThan(0.8);
    const normal = dailyQuest(MON, { tier: 1, progress: 0, prefs });
    const tired = dailyQuest(MON, { tier: 1, progress: 0, prefs, checkin: { sleep: 4, soreness: 5 } });
    expect(tired.name).toContain('RECOVERY-ADJUSTED');
    expect(tired.tasks.reduce((s, t) => s + t.target, 0)).toBeLessThan(normal.tasks.reduce((s, t) => s + t.target, 0));
  });
});

describe('records and reports', () => {
  it('finds bests and flags new records', () => {
    const d1 = MON;
    const d2 = addDays(MON, 1);
    const logs: Logs = {
      [d1]: { templateId: 'tpl_chest', exLogs: { e_bpress: { sets: [{ v: 60, reps: 5 }] } } },
      [d2]: { templateId: 'tpl_chest', exLogs: { e_bpress: { sets: [{ v: 70, reps: 5 }] } } },
    };
    const recs = personalRecords(logs, DEFAULT_TEMPLATES);
    expect(recs.find((r) => r.key === 'ex:e_bpress')!.detail).toBe('70 kg × 5');
    expect(newRecords(logs, DEFAULT_TEMPLATES, d2).map((r) => r.key)).toEqual(['ex:e_bpress']);
    expect(newRecords(logs, DEFAULT_TEMPLATES, d1)).toEqual([]);
  });

  it('grades the week', () => {
    const logs = run('xxxxxxx');
    const r = weeklyReport(L(logs, addDays(MON, 6)), logs, [], MON);
    expect(r.grade).toBe('S');
    expect(r.verified).toBe(7);
    expect(r.neglected).not.toBeNull();
    const bad = run('x--x---');
    expect(weeklyReport(L(bad, addDays(MON, 6)), bad, [], MON).grade).toBe('D');
  });
});

describe('unlocks, lore and boss', () => {
  it('opens features by level and reports only unseen ones', () => {
    expect(isUnlocked('body', 1)).toBe(false);
    expect(isUnlocked('body', 2)).toBe(true);
    expect(newUnlocks(4, ['body', 'stats']).map((u) => u.feature)).toEqual(['records', 'items', 'dungeons', 'shadows', 'reports']);
    expect(loreUnlocked(1)).toHaveLength(1);
  });

  it('boss HP scales with participants and damage counts verified days only', () => {
    expect(bossHp(10)).toBe(10 * bossHp(1));
    expect(bossFor('2026-11').name).toBe(bossFor('2026-11').name);
    const logs = run('xu', '2026-11-02');
    const l = L(logs, '2026-11-03');
    expect(monthDamage(l, logs, [], '2026-11-03')).toBeGreaterThan(0);
    expect(monthDamage(l, { '2026-11-03': logs['2026-11-03']! }, [], '2026-11-03')).toBe(0);
  });
});
