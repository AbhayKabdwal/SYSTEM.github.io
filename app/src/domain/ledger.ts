import { addDays, toDateStr, weekOf } from './dates';
import { isComplete, questDone } from './completion';
import { dayLoads, muscleCapacity, MUSCLES } from './muscles';
import { expForLevel, levelFor, MAX_LEVEL, RANK_GATES, titleFor } from './levels';
import { shadowName, type Inventory, type Shadow, type ShadowSource } from './army';
import type { DailyLog, DateStr, JobClass, Logs, Muscle, Player, Rank, StatKey, Template } from './types';

// The ledger replays every day from the player's first one, in order. Streaks,
// multipliers, penalties, items and rank all depend on history, so nothing is
// stored: edit a past day and everything after it re-scores consistently.

export const EXP = {
  questBase: 50,
  perTask: 12,
  perTier: 15,
  penaltyQuestBonus: 30,
  recoveryQuest: 50,
  /** Per hard-set equivalent of optional training. */
  perHse: 8,
  trainingCapBase: 80,
  trainingCapPerTier: 20,
  /** Share of quest EXP kept when the day has no photo proof. */
  unverifiedShare: 0.5,
  missBase: 40,
  missPerTier: 20,
  /** +1% per streak day, up to 30 days. */
  streakStep: 0.01,
  streakCap: 30,
  /** +1.5% per day in a row without a rest day, up to 14 days. */
  chainStep: 0.015,
  chainCap: 14,
  perfectWeekBase: 200,
  perfectWeekPerTier: 50,
  trialBase: 250,
  trialPerTier: 100,
  dungeonBase: 150,
  dungeonPerTier: 50,
  /** A dungeon break (last week's gate was skipped) pays this much more. */
  dungeonBreakMult: 1.5,
  /** One-time bonus per streak milestone: this × the milestone's day count. */
  milestonePerDay: 5,
  /** First quest ever cleared: enough to reach level 2 on day one. */
  firstClear: 25,
} as const;

/**
 * Effort Points: the competitive score. Rank sets how hard your quest is, not how many
 * points it's worth, so an E-rank and an S-rank clearing their own quests score the same.
 */
export const EP = {
  /** Full daily quest, scaled by the share of each task done. */
  quest: 60,
  /** Optional training, with diminishing returns relative to your own capacity. */
  training: 30,
  side: 10,
  /** Daily cap: consistency beats one huge day. */
  dayCap: 100,
} as const;

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];
/** How many of each item you can carry. Rewards past the cap are lost, so use them. */
export const ITEM_CAP = { shield: 3, elixir: 3, scroll: 5 } as const;
/** Streak milestones that also grant a Streak Shield. */
const SHIELD_MILESTONES = new Set([14, 30, 60, 100, 150, 200, 365]);
export const STAT_POINTS_PER_LEVEL = 3;
export const JOB_LEVEL = 40;
export const JOB_DAYS = 3;

/** Streak flame. Purely cosmetic, but it's what people chase. */
export const FLAMES = [
  { min: 0, name: 'Unlit', color: '#556677' },
  { min: 3, name: 'Ember', color: '#ff9944' },
  { min: 7, name: 'Blaze', color: '#ff6622' },
  { min: 14, name: 'Inferno', color: '#ff3355' },
  { min: 30, name: 'Blue Flame', color: '#33bbff' },
  { min: 60, name: 'Violet Flame', color: '#aa55ff' },
  { min: 100, name: "Monarch's Flame", color: '#ffdd00' },
] as const;

export const flameFor = (streak: number) => [...FLAMES].reverse().find((f) => streak >= f.min)!;

/** `shielded`: missed, but a Streak Shield absorbed it. */
export type DayStatus = 'verified' | 'unverified' | 'rest' | 'missed' | 'shielded' | 'open';

export interface DayResult {
  date: DateStr;
  status: DayStatus;
  quest: number;
  training: number;
  side: number;
  bonus: number;
  penalty: number;
  mult: number;
  /** Net EXP change for the day. */
  total: number;
  /** Effort Points, 0–100. */
  ep: number;
  /** Training freshness factor: training already-tired muscles counts for less. */
  fresh: number;
  streak: number;
  chain: number;
  tier: number;
  /** Cleared the penalty quest the day after a miss, so the streak came back. */
  restored?: boolean;
  /** An EXP Scroll doubled this day. */
  scroll?: boolean;
}

export type EventKind = 'unverified' | 'rest' | 'miss' | 'shield' | 'restore' | 'milestone' | 'perfect_week' | 'trial' | 'dungeon' | 'level' | 'item' | 'shadow';

export interface LedgerEvent {
  date: DateStr;
  kind: EventKind;
  text: string;
  exp: number;
}

export type Stats = Record<StatKey, number>;

export interface Ledger {
  exp: number;
  level: number;
  levelStart: number;
  levelNext: number | null;
  /** 0–100 through the current level. */
  levelProg: number;
  /** Promoted rank: 0 = E … 5 = S. Rises only by clearing a Rank-up Trial. */
  tier: number;
  rank: string;
  rankColor: string;
  title: Rank;
  /** 0–1 through the current rank band, for quest volume. */
  rankProgress: number;
  /** Level is high enough to attempt the next rank's trial. */
  trialReady: boolean;
  streak: number;
  chain: number;
  bestStreak: number;
  /** Multiplier the next verified clear would get. */
  nextMult: number;
  days: Record<DateStr, DayResult>;
  /** Newest first. */
  events: LedgerEvent[];
  /** Monday dates of weeks whose rest day is used. */
  restWeeks: Set<DateStr>;
  dungeonWeeks: Set<DateStr>;
  /** This week's dungeon is a break: last week's was skipped. */
  dungeonBreak: boolean;
  perfectWeeks: number;
  cleared: number;
  verified: number;
  weekExp: number;
  weekEp: number;
  /** Effort Points for the last 14 days, oldest first; today last. */
  recentEp: number[];
  /** Verified clear (or rest/shield, which keep the chain of days alive) for the last 14 days. */
  recentKept: boolean[];
  /** Derived stats plus allocated points and class bonus. */
  stats: Stats;
  baseStats: Stats;
  statPoints: { total: number; spent: number; free: number };
  inventory: Inventory;
  shadows: Shadow[];
  /** Days of the Job Change questline cleared (0–3). */
  jobProgress: number;
  jobReady: boolean;
  /** Yesterday was missed: today is a penalty day. */
  penaltyToday: boolean;
  /** Clearing today's penalty quest with proof restores this streak. */
  repairableStreak: number;
}

export const hasProof = (log: DailyLog | undefined, date: DateStr) => !!log?.proof && toDateStr(new Date(log.proof.at)) === date;

export const mondayOf = (d: DateStr) => weekOf(d)[0]!;

export const multiplier = (streak: number, chain: number) =>
  1 + Math.min(streak, EXP.streakCap) * EXP.streakStep + Math.min(chain, EXP.chainCap) * EXP.chainStep;

function questExp(log: DailyLog, tier: number): number {
  const q = log.dailyQuest!;
  const kind = q.kind ?? (log.penaltyAttempt ? 'penalty' : 'daily');
  if (kind === 'recovery') return EXP.recoveryQuest;
  const base = EXP.questBase + EXP.perTask * q.tasks.length + EXP.perTier * (q.tier ?? tier);
  return kind === 'penalty' ? base + EXP.penaltyQuestBonus : base;
}

/** Mean share of each task done, capped at 100% per task. Partial effort still counts. */
export function questShare(log: DailyLog | undefined): number {
  const tasks = log?.dailyQuest?.tasks ?? [];
  if (!tasks.length) return 0;
  return tasks.reduce((s, t) => s + Math.min(1, Math.max(0, Number(log?.questProgress?.[t.id] ?? 0)) / t.target), 0) / tasks.length;
}

/** Training a fresh muscle counts a little more; hammering an overloaded one counts half. */
export function freshnessFactor(fatiguePct: number): number {
  if (fatiguePct < 25) return 1.1;
  if (fatiguePct < 55) return 1;
  if (fatiguePct < 80) return 0.8;
  return 0.5;
}

function startDate(logs: Logs, player: Player | null): DateStr | null {
  const dates = Object.keys(logs).sort();
  const created = player?.createdAt ? toDateStr(new Date(player.createdAt)) : null;
  const first = dates[0] ?? null;
  if (!first) return created;
  return created && created < first ? created : first;
}

const statFrom = (points: number) => 10 + Math.floor(Math.sqrt(Math.max(0, points)) * 1.5);

export const CLASS_STAT: Record<JobClass, StatKey> = { fighter: 'str', assassin: 'agi', mage: 'sen' };
const CLASS_BONUS = 5;
const DAY_DECAY = Object.fromEntries(MUSCLES.map((m) => [m.id, 0.5 ** (24 / m.halfLife)])) as Record<Muscle, number>;

export function computeLedger(logs: Logs, templates: Template[], player: Player | null, today: DateStr): Ledger {
  const loads = dayLoads(logs, templates);
  const rulesSince = player?.rulesSince;
  const waterTarget = player?.waterTarget ?? 8;
  const days: Record<DateStr, DayResult> = {};
  const events: LedgerEvent[] = [];
  const restWeeks = new Set<DateStr>();
  const dungeonWeeks = new Set<DateStr>();
  const inventory: Inventory = { shield: 0, elixir: 0, scroll: 0 };
  const shadows: Shadow[] = [];
  const muscleAcc: Partial<Record<Muscle, number>> = {};
  let exp = 0;
  let level = 1;
  let tier = 0;
  let streak = 0;
  let chain = 0;
  let best = 0;
  let perfectWeeks = 0;
  let cleared = 0;
  let verified = 0;
  let dungeonClears = 0;
  let jobProgress = 0;
  let breakWeek = false;
  let weekHadMiss = false;
  let weekActive = false;
  type Repair = { streak: number; date: DateStr };
  let repair = null as Repair | null;
  const axes = { strength: 0, agility: 0, skill: 0, proof: 0, recovery: 0, rests: 0, checkins: 0 };

  const extract = (d: DateStr, source: ShadowSource, rank: string) => {
    const s: Shadow = { id: `${source}:${d}`, name: shadowName(`${source}:${d}`), rank, source, date: d, wounded: false };
    shadows.push(s);
    events.push({ date: d, kind: 'shadow', text: `Shadow extracted: ${s.name} (${rank}-Rank)`, exp: 0 });
  };

  const start = startDate(logs, player);
  for (let d = start; d && d <= today; d = addDays(d, 1)) {
    const log = logs[d];
    const legacy = !rulesSince || d < rulesSince;
    const done = isComplete(log);
    const week = mondayOf(d);

    // A new week: last week's dungeon was skipped while you were active, so this week's breaks open.
    if (d === week) {
      breakWeek = level >= 4 && weekActive && !dungeonWeeks.has(addDays(d, -7)) && !legacy;
      weekActive = false;
      weekHadMiss = false;
    }

    let status: DayStatus;
    if (done) status = legacy || hasProof(log, d) ? 'verified' : 'unverified';
    else if (log?.rest && !legacy && !restWeeks.has(week)) status = 'rest';
    else if (log?.rest && !legacy && inventory.elixir > 0) {
      inventory.elixir--;
      status = 'rest';
      events.push({ date: d, kind: 'item', text: 'Rest Elixir used: second rest day this week', exp: 0 });
    } else if (d === today) status = 'open';
    else if (!legacy && inventory.shield > 0) {
      inventory.shield--;
      status = 'shielded';
      events.push({ date: d, kind: 'shield', text: 'Streak Shield absorbed a missed day', exp: 0 });
    } else status = 'missed';

    const day: DayResult = { date: d, status, quest: 0, training: 0, side: 0, bonus: 0, penalty: 0, mult: 1, total: 0, ep: 0, fresh: 1, streak, chain, tier };
    const load = loads[d];

    // Freshness: how tired were today's muscles before today's session?
    for (const m of MUSCLES) if (muscleAcc[m.id]) muscleAcc[m.id]! *= DAY_DECAY[m.id];
    const cap = muscleCapacity(tier);
    let wSum = 0;
    let fSum = 0;
    for (const [m, l] of Object.entries(load?.muscles ?? {}) as [Muscle, number][]) {
      const pct = 100 * (1 - Math.exp(-(muscleAcc[m] ?? 0) / cap));
      wSum += l;
      fSum += l * freshnessFactor(pct);
    }
    if (wSum) day.fresh = fSum / wSum;
    for (const [m, l] of Object.entries(load?.muscles ?? {}) as [Muscle, number][]) muscleAcc[m] = (muscleAcc[m] ?? 0) + l;

    const trainingCap = EXP.trainingCapBase + EXP.trainingCapPerTier * tier;
    day.training = Math.round(Math.min((load?.trainingHse ?? 0) * EXP.perHse * day.fresh, trainingCap));

    if (done) {
      cleared++;
      weekActive = true;
      day.quest = questExp(log!, tier);
      if (cleared === 1) {
        day.bonus += EXP.firstClear;
        events.push({ date: d, kind: 'milestone', text: 'First quest cleared', exp: EXP.firstClear });
      }
      if (status === 'unverified') {
        day.quest = Math.round(day.quest * EXP.unverifiedShare);
        chain = 0;
        if (d !== today) events.push({ date: d, kind: 'unverified', text: 'Quest cleared without proof: half EXP, streak held', exp: 0 });
      } else {
        verified++;
        if (!legacy && repair && repair.date === addDays(d, -1) && log!.penaltyAttempt) {
          streak = repair.streak + 1;
          day.restored = true;
          events.push({ date: d, kind: 'restore', text: `Survived the penalty zone: ${repair.streak}-day streak restored`, exp: 0 });
          repair = null;
        } else streak++;
        chain++;
        day.mult = multiplier(streak, chain);
      }
    } else if (status === 'rest') {
      restWeeks.add(week);
      axes.rests++;
      chain = 0;
      events.push({ date: d, kind: 'rest', text: 'Rest day taken: streak kept, momentum reset', exp: 0 });
    } else if (status === 'shielded') {
      chain = 0;
    } else if (status === 'missed') {
      if (!legacy) {
        day.penalty = EXP.missBase + EXP.missPerTier * tier;
        repair = streak > 0 ? { streak, date: d } : null;
        events.push({ date: d, kind: 'miss', text: `Daily quest failed: −${day.penalty} EXP, streak broken`, exp: -day.penalty });
        weekHadMiss = true;
      }
      streak = 0;
      chain = 0;
    }
    if (repair && repair.date < addDays(d, -1)) repair = null;

    // EXP Scroll: doubles the day's quest and training EXP.
    if (log?.items?.scroll && inventory.scroll > 0 && (done || day.training > 0)) {
      inventory.scroll--;
      day.scroll = true;
      day.mult *= 2;
      events.push({ date: d, kind: 'item', text: 'EXP Scroll used: double EXP today', exp: 0 });
    }

    // Side quests.
    const dungeon = log?.side?.dungeon;
    let epSide = 0;
    if (dungeon && !dungeonWeeks.has(week) && questDone(dungeon.quest, dungeon.progress)) {
      dungeonWeeks.add(week);
      dungeonClears++;
      const gain = Math.round((EXP.dungeonBase + EXP.dungeonPerTier * tier) * (breakWeek ? EXP.dungeonBreakMult : 1));
      day.side += gain;
      epSide += EP.side;
      events.push({ date: d, kind: 'dungeon', text: `${dungeon.quest.name.replace(/^(INSTANT DUNGEON|DUNGEON BREAK): /, '')} cleared${breakWeek ? ' (break)' : ''}`, exp: gain });
      extract(d, 'dungeon', RANK_GATES[tier]!.rank);
      if (dungeonClears % 2 === 0 && inventory.elixir < ITEM_CAP.elixir) {
        inventory.elixir++;
        events.push({ date: d, kind: 'item', text: 'Found a Rest Elixir', exp: 0 });
      }
    }

    if (streak > best) {
      for (const m of STREAK_MILESTONES) {
        if (best < m && m <= streak) {
          day.bonus += EXP.milestonePerDay * m;
          events.push({ date: d, kind: 'milestone', text: `${m}-day streak milestone`, exp: EXP.milestonePerDay * m });
          if (SHIELD_MILESTONES.has(m) && inventory.shield < ITEM_CAP.shield) {
            inventory.shield++;
            events.push({ date: d, kind: 'item', text: 'Earned a Streak Shield', exp: 0 });
          }
        }
      }
      best = streak;
    }

    // Week ends: a perfect week pays out and heals the army; a week with a miss wounds a shadow.
    const wk = weekOf(d);
    if (d === wk[6]) {
      if (rulesSince && wk[0]! >= rulesSince && wk.every((x) => (x === d ? status : days[x]?.status) === 'verified')) {
        perfectWeeks++;
        const gain = EXP.perfectWeekBase + EXP.perfectWeekPerTier * tier;
        day.bonus += gain;
        const found = inventory.scroll < ITEM_CAP.scroll;
        if (found) inventory.scroll++;
        events.push({ date: d, kind: 'perfect_week', text: `Perfect week: 7 of 7 with no rest day${found ? '. Found an EXP Scroll' : ''}`, exp: gain });
        for (const s of shadows) s.wounded = false;
        extract(d, 'perfect_week', RANK_GATES[tier]!.rank);
      } else if (weekHadMiss || status === 'missed') {
        const healthy = [...shadows].reverse().find((s) => !s.wounded);
        if (healthy) healthy.wounded = true;
      }
    }

    const before = exp;
    const applyLevel = () => {
      const newLevel = levelFor(exp);
      if (newLevel > level) {
        events.push({ date: d, kind: 'level', text: `Level up: ${newLevel}`, exp: 0 });
        level = newLevel;
      }
    };
    exp = Math.max(expForLevel(level), exp + Math.round((day.quest + day.training) * day.mult) + day.side + day.bonus - day.penalty);
    applyLevel();

    // After the day's EXP, so a trial taken the day you reach the level still counts.
    const trial = log?.side?.trial;
    const next = RANK_GATES[tier + 1];
    if (trial && next && trial.rank === next.rank && level >= next.level && questDone(trial.quest, trial.progress)) {
      tier++;
      const gain = EXP.trialBase + EXP.trialPerTier * tier;
      day.side += gain;
      exp += gain;
      epSide += EP.side;
      events.push({ date: d, kind: 'trial', text: `Rank-up trial cleared: promoted to ${next.rank}-Rank`, exp: gain });
      extract(d, 'trial', next.rank);
      applyLevel();
    }
    // Also after the day's EXP: the Job Change quest counts on the day you reach level 40.
    const job = log?.side?.job;
    if (job && level >= JOB_LEVEL && jobProgress < JOB_DAYS && questDone(job.quest, job.progress)) {
      jobProgress++;
      epSide += EP.side;
    }
    day.total = exp - before;

    // Effort Points: quest share and training relative to your own capacity, never your rank.
    if (status !== 'rest' && status !== 'shielded') {
      const share = questShare(log) * (status === 'unverified' ? EXP.unverifiedShare : 1);
      const x = (load?.trainingHse ?? 0) / muscleCapacity(tier);
      day.ep = Math.min(EP.dayCap, Math.round(EP.quest * share + EP.training * (1 - Math.exp(-x)) * day.fresh + epSide));
    }

    day.streak = streak;
    day.chain = chain;
    days[d] = day;

    if (load) {
      axes.strength += load.axes.strength;
      axes.agility += load.axes.agility;
      axes.skill += load.axes.skill;
    }
    if (status === 'verified' && !legacy) axes.proof++;
    if ((log?.recovery?.water ?? 0) >= waterTarget) axes.recovery++;
    if (log?.checkin) axes.checkins++;
  }

  const lastRepair = repair as Repair | null;
  const levelStart = expForLevel(level);
  const levelNext = level < MAX_LEVEL ? expForLevel(level + 1) : null;
  const gate = RANK_GATES[tier]!;
  const nextGate = RANK_GATES[tier + 1];
  const yesterday = addDays(today, -1);
  const todayStatus = days[today]?.status;
  // Today's clear already counted; otherwise the multiplier a clear today would get.
  const pendingStreak = todayStatus === 'verified' ? streak : streak + 1;
  const pendingChain = todayStatus === 'verified' ? chain : chain + 1;
  const weekStart = mondayOf(today);
  const thisWeek = Object.values(days).filter((x) => x.date >= weekStart);
  const recentDates = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  const baseStats: Stats = {
    str: statFrom(axes.strength),
    agi: statFrom(axes.agility),
    vit: statFrom(cleared * 3 + best * 2),
    sen: statFrom(axes.skill),
    int: statFrom(axes.proof * 3 + axes.recovery * 2 + axes.rests * 2 + axes.checkins * 2),
  };
  const alloc = player?.statAlloc ?? {};
  const spent = Object.values(alloc).reduce((s, n) => s + (n ?? 0), 0);
  const total = (level - 1) * STAT_POINTS_PER_LEVEL;
  const stats = Object.fromEntries(
    (Object.keys(baseStats) as StatKey[]).map((k) => [k, baseStats[k] + (alloc[k] ?? 0) + (player?.jobClass && CLASS_STAT[player.jobClass] === k ? CLASS_BONUS : 0)]),
  ) as Stats;

  return {
    exp,
    level,
    levelStart,
    levelNext,
    levelProg: levelNext ? ((exp - levelStart) / (levelNext - levelStart)) * 100 : 100,
    tier,
    rank: gate.rank,
    rankColor: gate.color,
    title: titleFor(level),
    rankProgress: nextGate ? Math.min(1, Math.max(0, (level - gate.level) / (nextGate.level - gate.level))) : 1,
    trialReady: !!nextGate && level >= nextGate.level,
    streak,
    chain,
    bestStreak: best,
    nextMult: multiplier(pendingStreak, pendingChain),
    days,
    events: events.reverse(),
    restWeeks,
    dungeonWeeks,
    dungeonBreak: breakWeek,
    perfectWeeks,
    cleared,
    verified,
    weekExp: thisWeek.reduce((s, x) => s + x.total, 0),
    weekEp: thisWeek.reduce((s, x) => s + x.ep, 0),
    recentEp: recentDates.map((d) => days[d]?.ep ?? 0),
    recentKept: recentDates.map((d) => ['verified', 'rest', 'shielded'].includes(days[d]?.status ?? '')),
    stats,
    baseStats,
    statPoints: { total, spent, free: Math.max(0, total - spent) },
    inventory,
    shadows,
    jobProgress,
    jobReady: jobProgress >= JOB_DAYS && !player?.jobClass,
    penaltyToday: days[yesterday]?.status === 'missed',
    repairableStreak: lastRepair?.date === yesterday ? lastRepair.streak : 0,
  };
}

/** Rest day still free this week (or an elixir can cover a second one). */
export const restAvailable = (ledger: Ledger, today: DateStr) =>
  !ledger.restWeeks.has(mondayOf(today)) || ledger.days[today]?.status === 'rest' || ledger.inventory.elixir > 0;
