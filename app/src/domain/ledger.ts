import { addDays, toDateStr, weekOf } from './dates';
import { isComplete, questDone } from './completion';
import { dayLoads } from './muscles';
import { expForLevel, levelFor, MAX_LEVEL, RANK_GATES, titleFor } from './levels';
import type { DailyLog, DateStr, Logs, Player, Rank, Template } from './types';

// The ledger replays every day from the player's first one, in order. Streaks,
// multipliers, penalties and rank all depend on history, so nothing is stored:
// edit a past day and everything after it re-scores consistently.

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
  /** One-time bonus per streak milestone: this × the milestone's day count. */
  milestonePerDay: 5,
} as const;

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

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

export type DayStatus = 'verified' | 'unverified' | 'rest' | 'missed' | 'open';

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
  streak: number;
  chain: number;
  tier: number;
  /** Cleared the penalty quest the day after a miss, so the streak came back. */
  restored?: boolean;
}

export type EventKind = 'unverified' | 'rest' | 'miss' | 'restore' | 'milestone' | 'perfect_week' | 'trial' | 'dungeon' | 'level';

export interface LedgerEvent {
  date: DateStr;
  kind: EventKind;
  text: string;
  exp: number;
}

export interface Stats {
  str: number;
  agi: number;
  vit: number;
  sen: number;
  int: number;
}

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
  perfectWeeks: number;
  cleared: number;
  verified: number;
  weekExp: number;
  stats: Stats;
  /** Yesterday was missed: today is a penalty day. */
  penaltyToday: boolean;
  /** Clearing today's penalty quest with proof restores this streak. */
  repairableStreak: number;
}

export const hasProof = (log: DailyLog | undefined, date: DateStr) => !!log?.proof && toDateStr(new Date(log.proof.at)) === date;

const mondayOf = (d: DateStr) => weekOf(d)[0]!;

export const multiplier = (streak: number, chain: number) =>
  1 + Math.min(streak, EXP.streakCap) * EXP.streakStep + Math.min(chain, EXP.chainCap) * EXP.chainStep;

function questExp(log: DailyLog, tier: number): number {
  const q = log.dailyQuest!;
  const kind = q.kind ?? (log.penaltyAttempt ? 'penalty' : 'daily');
  if (kind === 'recovery') return EXP.recoveryQuest;
  const base = EXP.questBase + EXP.perTask * q.tasks.length + EXP.perTier * (q.tier ?? tier);
  return kind === 'penalty' ? base + EXP.penaltyQuestBonus : base;
}

function startDate(logs: Logs, player: Player | null): DateStr | null {
  const dates = Object.keys(logs).sort();
  const created = player?.createdAt ? toDateStr(new Date(player.createdAt)) : null;
  const first = dates[0] ?? null;
  if (!first) return created;
  return created && created < first ? created : first;
}

const statFrom = (points: number) => 10 + Math.floor(Math.sqrt(Math.max(0, points)) * 1.5);

export function computeLedger(logs: Logs, templates: Template[], player: Player | null, today: DateStr): Ledger {
  const loads = dayLoads(logs, templates);
  const rulesSince = player?.rulesSince;
  const waterTarget = player?.waterTarget ?? 8;
  const days: Record<DateStr, DayResult> = {};
  const events: LedgerEvent[] = [];
  const restWeeks = new Set<DateStr>();
  const dungeonWeeks = new Set<DateStr>();
  let exp = 0;
  let level = 1;
  let tier = 0;
  let streak = 0;
  let chain = 0;
  let best = 0;
  let perfectWeeks = 0;
  let cleared = 0;
  let verified = 0;
  type Repair = { streak: number; date: DateStr };
  let repair = null as Repair | null;
  const axes = { strength: 0, agility: 0, skill: 0, proof: 0, recovery: 0, rests: 0 };

  const start = startDate(logs, player);
  for (let d = start; d && d <= today; d = addDays(d, 1)) {
    const log = logs[d];
    const legacy = !rulesSince || d < rulesSince;
    const done = isComplete(log);
    const week = mondayOf(d);
    let status: DayStatus;
    if (done) status = legacy || hasProof(log, d) ? 'verified' : 'unverified';
    else if (log?.rest && !legacy && !restWeeks.has(week)) status = 'rest';
    else status = d === today ? 'open' : 'missed';

    const day: DayResult = { date: d, status, quest: 0, training: 0, side: 0, bonus: 0, penalty: 0, mult: 1, total: 0, streak, chain, tier };
    const load = loads[d];
    const trainingCap = EXP.trainingCapBase + EXP.trainingCapPerTier * tier;
    day.training = Math.round(Math.min((load?.trainingHse ?? 0) * EXP.perHse, trainingCap));

    if (done) {
      cleared++;
      day.quest = questExp(log!, tier);
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
    } else if (status === 'missed') {
      if (!legacy) {
        day.penalty = EXP.missBase + EXP.missPerTier * tier;
        repair = streak > 0 ? { streak, date: d } : null;
        events.push({ date: d, kind: 'miss', text: `Daily quest failed: −${day.penalty} EXP, streak broken`, exp: -day.penalty });
      }
      streak = 0;
      chain = 0;
    }
    if (repair && repair.date < addDays(d, -1)) repair = null;

    // Side quests.
    const dungeon = log?.side?.dungeon;
    if (dungeon && !dungeonWeeks.has(week) && questDone(dungeon.quest, dungeon.progress)) {
      dungeonWeeks.add(week);
      const gain = EXP.dungeonBase + EXP.dungeonPerTier * tier;
      day.side += gain;
      events.push({ date: d, kind: 'dungeon', text: `${dungeon.quest.name.replace('INSTANT DUNGEON: ', '')} cleared`, exp: gain });
    }

    if (streak > best) {
      for (const m of STREAK_MILESTONES) {
        if (best < m && m <= streak) {
          day.bonus += EXP.milestonePerDay * m;
          events.push({ date: d, kind: 'milestone', text: `${m}-day streak milestone`, exp: EXP.milestonePerDay * m });
        }
      }
      best = streak;
    }

    // A perfect week: seven verified clears Monday–Sunday, no rest day.
    const wk = weekOf(d);
    if (d === wk[6] && rulesSince && wk[0]! >= rulesSince && wk.every((x) => (x === d ? status : days[x]?.status) === 'verified')) {
      perfectWeeks++;
      const gain = EXP.perfectWeekBase + EXP.perfectWeekPerTier * tier;
      day.bonus += gain;
      events.push({ date: d, kind: 'perfect_week', text: 'Perfect week: 7 of 7 with no rest day', exp: gain });
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
      events.push({ date: d, kind: 'trial', text: `Rank-up trial cleared: promoted to ${next.rank}-Rank`, exp: gain });
      applyLevel();
    }
    day.total = exp - before;

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
    perfectWeeks,
    cleared,
    verified,
    weekExp: Object.values(days)
      .filter((x) => x.date >= weekStart)
      .reduce((s, x) => s + x.total, 0),
    stats: {
      str: statFrom(axes.strength),
      agi: statFrom(axes.agility),
      vit: statFrom(cleared * 3 + best * 2),
      sen: statFrom(axes.skill),
      int: statFrom(axes.proof * 3 + axes.recovery * 2 + axes.rests * 2),
    },
    penaltyToday: days[yesterday]?.status === 'missed',
    repairableStreak: lastRepair?.date === yesterday ? lastRepair.streak : 0,
  };
}

/** Rest day still free this week (and today isn't already cleared). */
export const restAvailable = (ledger: Ledger, today: DateStr) => !ledger.restWeeks.has(mondayOf(today)) || ledger.days[today]?.status === 'rest';
