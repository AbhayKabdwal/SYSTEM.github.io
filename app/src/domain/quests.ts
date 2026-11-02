import { addDays } from './dates';
import { DEFAULT_QUEST_POOL, PENALTY_QUEST, RECOVERY_QUEST } from './defaults';
import { getFatigue, DELOAD_THRESHOLD } from './fatigue';
import { LIBRARY, libraryExercise, QUEST_PATTERNS, TIERS, type LibraryExercise, type Tier } from './library';
import { fits } from './prefs';
import type { DateStr, Logs, Pattern, Preferences, Quest, QuestTask } from './types';

const TASKS_PER_QUEST = 3;
const MIN_POOL_SIZE = 3;

// FNV-1a: v1 summed char codes, so dates with the same digits (e.g. 11-02 / 11-20)
// got the same quest and the whole year shared only ~40 distinct seeds.
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = (seed: string) => mulberry32(hashString(seed));

/** Deterministic: the same date and pool always give the same tasks. Used until the player calibrates. */
export function randomGate(date: DateStr, pool: QuestTask[]): Quest {
  const source = pool.length >= MIN_POOL_SIZE ? pool : DEFAULT_QUEST_POOL;
  const rand = rng(date);
  const shuffled = [...source];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return { name: 'DAILY QUEST: RANDOM GATE', tasks: shuffled.slice(0, TASKS_PER_QUEST), kind: 'daily' };
}

// ── Library quests ───────────────────────────────────────────────────────────

export const clampTier = (t: number): Tier => Math.max(0, Math.min(5, Math.round(t))) as Tier;

const TASKS_FOR_MINUTES = { 15: 3, 30: 4, 45: 5, 60: 6 } as const;
const VOLUME_FOR_MINUTES = { 15: 0.85, 30: 1, 45: 1.1, 60: 1.2 } as const;
const VOLUME_FOR_EXPERIENCE = { beginner: 0.8, intermediate: 1, advanced: 1.1 } as const;

function niceRound(v: number, unit: string): number {
  if (unit === 'km') return Math.max(0.5, Math.round(v * 2) / 2);
  if (unit === 'min') return Math.max(1, Math.round(v));
  if (unit === 'sec') return Math.max(15, Math.round(v / 15) * 15);
  return v >= 20 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v));
}

/**
 * Volume for an exercise at a tier. A variation used past its top tier (no harder
 * variation available, e.g. no pull-up bar) gets 15% more volume per tier instead.
 */
function targetAt(ex: LibraryExercise, tier: Tier, scale: number): number {
  const t = Math.max(ex.tiers[0], Math.min(ex.tiers[1], tier)) as Tier;
  const over = Math.max(0, tier - ex.tiers[1]);
  return niceRound((ex.targets[t] ?? 0) * (1 + 0.15 * over) * scale, ex.unit);
}

function toTask(ex: LibraryExercise, tier: Tier, scale: number): QuestTask {
  return { id: ex.id, label: ex.name, target: targetAt(ex, tier, scale), unit: ex.unit, muscles: ex.muscles, pattern: ex.pattern, hardSet: ex.hardSet };
}

/** Best variation for a tier: one whose range covers it, else the hardest one below it. */
function pickVariation(candidates: LibraryExercise[], tier: Tier, rand: () => number): LibraryExercise | undefined {
  const inRange = candidates.filter((e) => e.tiers[0] <= tier && tier <= e.tiers[1]);
  if (inRange.length) return inRange[Math.floor(rand() * inRange.length)];
  const below = candidates.filter((e) => e.tiers[1] < tier).sort((a, b) => b.tiers[1] - a.tiers[1]);
  if (below.length) return below[0];
  return [...candidates].sort((a, b) => a.tiers[0] - b.tiers[0])[0];
}

function patternWeights(prefs: Preferences): Record<Pattern, number> {
  const w: Record<Pattern, number> = { push: 1, pull: 1, squat: 1, hinge: 0.7, core: 1, cardio: 0.6, conditioning: 0.6, mobility: 0 };
  const boosts: Record<string, Partial<Record<Pattern, number>>> = {
    strength: { push: 2, pull: 2, squat: 2, hinge: 1, core: 1 },
    muscle: { push: 2, pull: 2, squat: 1.5, hinge: 1.5 },
    endurance: { cardio: 3, conditioning: 2, core: 1 },
    fat_loss: { conditioning: 3, cardio: 2, squat: 1 },
    skills: { push: 1, pull: 2, core: 2 },
  };
  for (const g of prefs.goals) for (const [p, n] of Object.entries(boosts[g] ?? {}) as [Pattern, number][]) w[p] += n;
  const double = { upper: ['push', 'pull'], lower: ['squat', 'hinge'], core: ['core'], balanced: [] }[prefs.focus] as Pattern[];
  for (const p of double) w[p] *= 2;
  return w;
}

function poolExercises(prefs: Preferences): LibraryExercise[] {
  return prefs.pool.map(libraryExercise).filter((e): e is LibraryExercise => !!e && e.pattern !== 'mobility' && fits(e, prefs));
}

/** Weighted sampling without replacement. */
function sample<T>(items: T[], weight: (t: T) => number, n: number, rand: () => number): T[] {
  const left = [...items];
  const out: T[] = [];
  while (out.length < n && left.length) {
    const total = left.reduce((s, x) => s + weight(x), 0);
    let r = rand() * total;
    let i = 0;
    for (; i < left.length - 1; i++) {
      r -= weight(left[i]!);
      if (r <= 0) break;
    }
    out.push(left.splice(i, 1)[0]!);
  }
  return out;
}

export interface GenContext {
  tier: Tier;
  /** 0–1 progress through the current rank: volume rises as you approach the next one. */
  progress: number;
  prefs: Preferences;
  /** Yesterday's quest. Its patterns are less likely today so muscles get a day off. */
  yesterday?: Quest;
}

function scaleFor(ctx: GenContext) {
  return VOLUME_FOR_EXPERIENCE[ctx.prefs.experience] * VOLUME_FOR_MINUTES[ctx.prefs.minutes] * (1 + 0.4 * Math.max(0, Math.min(1, ctx.progress)));
}

/** Advanced trainees start one variation up; ranks still gate everything after that. */
const variationTier = (ctx: GenContext) => clampTier(ctx.tier + (ctx.prefs.experience === 'advanced' ? 1 : 0));

function buildTasks(seed: string, ctx: GenContext, n: number, scale: number, tier: Tier, patterns?: Pattern[]): QuestTask[] {
  const rand = rng(seed);
  const pool = poolExercises(ctx.prefs);
  const available = (patterns ?? QUEST_PATTERNS).filter((p) => pool.some((e) => e.pattern === p));
  const weights = patternWeights(ctx.prefs);
  const recent = new Set(ctx.yesterday?.tasks.map((t) => t.pattern ?? libraryExercise(t.id)?.pattern));
  const chosen = patterns ? available.slice(0, n) : sample(available, (p) => weights[p] * (recent.has(p) ? 0.35 : 1), n, rand);
  return chosen
    .map((p) => pickVariation(pool.filter((e) => e.pattern === p), tier, rand))
    .filter((e): e is LibraryExercise => !!e)
    .map((e) => toTask(e, tier, scale));
}

export function dailyQuest(date: DateStr, ctx: GenContext): Quest {
  const n = TASKS_FOR_MINUTES[ctx.prefs.minutes];
  return {
    name: `DAILY QUEST · ${TIERS[ctx.tier]}-RANK TRAINING`,
    tasks: buildTasks(`daily:${date}`, ctx, n, scaleFor(ctx), variationTier(ctx)),
    kind: 'daily',
    tier: ctx.tier,
  };
}

const PENALTY_CHOICES: Partial<Record<Pattern, string[]>> = {
  conditioning: ['burpees', 'squat_thrust', 'mountain_climbers', 'high_knees'],
  squat: ['squat', 'wall_sit', 'chair_squat'],
  core: ['plank', 'dead_bug'],
};

/** Survival training, scaled to rank and kept clear of flagged joints. 25% over a normal day's volume. */
export function penaltyQuest(tier: Tier, prefs: Preferences): Quest {
  const tasks: QuestTask[] = [];
  for (const ids of Object.values(PENALTY_CHOICES)) {
    const options = ids!.map(libraryExercise).filter((e): e is LibraryExercise => !!e && fits(e, { equipment: [], limits: prefs.limits }));
    const ex = pickVariation(options, tier, () => 0);
    if (ex) tasks.push(toTask(ex, tier, 1.25 * VOLUME_FOR_EXPERIENCE[prefs.experience]));
  }
  return { name: 'PENALTY QUEST: SURVIVAL TRAINING', tasks, kind: 'penalty', tier };
}

/** Tested at the next rank's variations and 1.3× volume. One fixed trial per rank. */
export function trialQuest(nextTier: Tier, prefs: Preferences): Quest {
  const ctx: GenContext = { tier: nextTier, progress: 0, prefs };
  return {
    name: `RANK-UP TRIAL: ${TIERS[nextTier]}-RANK GATE`,
    tasks: buildTasks(`trial:${nextTier}`, ctx, 4, 1.3 * VOLUME_FOR_EXPERIENCE[prefs.experience], variationTier(ctx), ['push', 'pull', 'squat', 'core']),
    kind: 'trial',
    tier: nextTier,
  };
}

const DUNGEONS = ['CRIMSON GATE', 'FROSTBOUND CAVERN', 'SUNKEN CITADEL', 'IRON CATACOMBS', 'ASHEN SPIRE', 'HOLLOW WOODS', 'STORM KEEP', 'OBSIDIAN MAZE'];

/** Weekly optional boss run: five patterns at 1.4× volume. */
export function dungeonQuest(weekStart: DateStr, ctx: GenContext): Quest {
  const rand = rng(`dungeon-name:${weekStart}`);
  return {
    name: `INSTANT DUNGEON: ${DUNGEONS[Math.floor(rand() * DUNGEONS.length)]}`,
    tasks: buildTasks(`dungeon:${weekStart}`, { ...ctx, yesterday: undefined }, 5, 1.4 * scaleFor(ctx), variationTier(ctx)),
    kind: 'dungeon',
    tier: ctx.tier,
  };
}

export interface QuestContext {
  today: DateStr;
  penalty?: boolean;
  pool?: QuestTask[];
  logs?: Logs;
  prefs?: Preferences;
  tier?: Tier;
  progress?: number;
}

export function questForDate(date: DateStr, ctx: QuestContext): Quest {
  const { today, penalty = false, pool = DEFAULT_QUEST_POOL, logs = {}, prefs, tier = 0, progress = 0 } = ctx;
  const deload = getFatigue(logs, today) >= DELOAD_THRESHOLD;
  if (penalty) return deload ? RECOVERY_QUEST : prefs ? penaltyQuest(tier, prefs) : PENALTY_QUEST;
  if (date === today && deload) return RECOVERY_QUEST;
  if (!prefs) return randomGate(date, pool);
  return dailyQuest(date, { tier, progress, prefs, yesterday: logs[addDays(date, -1)]?.dailyQuest });
}

/** Tasks the library would consider for a pattern, for the pool editor. */
export const libraryFor = (pattern: Pattern) => LIBRARY.filter((e) => e.pattern === pattern);
