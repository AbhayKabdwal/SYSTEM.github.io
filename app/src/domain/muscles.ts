import { parseDateStr } from './dates';
import { libraryExercise } from './library';
import type { DailyLog, DateStr, ExerciseSet, Logs, Muscle, MuscleWeights, Pattern, QuestTask, Template } from './types';

export interface MuscleInfo {
  id: Muscle;
  label: string;
  /**
   * Hours for accumulated load to halve. Large, slow-twitch-heavy muscles recover
   * slower; small ones like calves and forearms bounce back within a day or two.
   */
  halfLife: number;
}

export const MUSCLES: MuscleInfo[] = [
  { id: 'chest', label: 'Chest', halfLife: 26 },
  { id: 'front_delts', label: 'Front Delts', halfLife: 20 },
  { id: 'side_delts', label: 'Side Delts', halfLife: 18 },
  { id: 'rear_delts', label: 'Rear Delts', halfLife: 18 },
  { id: 'biceps', label: 'Biceps', halfLife: 20 },
  { id: 'triceps', label: 'Triceps', halfLife: 20 },
  { id: 'forearms', label: 'Forearms', halfLife: 16 },
  { id: 'abs', label: 'Abs', halfLife: 16 },
  { id: 'obliques', label: 'Obliques', halfLife: 16 },
  { id: 'lats', label: 'Lats', halfLife: 26 },
  { id: 'traps', label: 'Traps', halfLife: 22 },
  { id: 'lower_back', label: 'Lower Back', halfLife: 30 },
  { id: 'glutes', label: 'Glutes', halfLife: 28 },
  { id: 'quads', label: 'Quads', halfLife: 30 },
  { id: 'hamstrings', label: 'Hamstrings', halfLife: 30 },
  { id: 'calves', label: 'Calves', halfLife: 16 },
];

export const MUSCLE_IDS = MUSCLES.map((m) => m.id);

// Checked in order; first match wins. Keys are substrings of the lower-cased exercise name.
const NAME_RULES: [string[], MuscleWeights][] = [
  [['incline'], { chest: 0.9, front_delts: 0.7, triceps: 0.5 }],
  [['bench', 'chest press', 'fly', 'flies', 'pec'], { chest: 1, front_delts: 0.5, triceps: 0.5 }],
  [['dip'], { chest: 0.7, triceps: 1, front_delts: 0.4 }],
  [['pike', 'hspu', 'handstand'], { front_delts: 1, side_delts: 0.5, triceps: 0.7, traps: 0.3 }],
  [['push-up', 'pushup', 'push up', 'planche'], { chest: 1, front_delts: 0.6, triceps: 0.6, abs: 0.3 }],
  [['overhead', 'ohp', 'military', 'shoulder press'], { front_delts: 1, side_delts: 0.6, triceps: 0.6 }],
  [['lateral raise', 'lateral'], { side_delts: 1, traps: 0.3 }],
  [['face pull', 'rear delt', 'reverse fly'], { rear_delts: 1, traps: 0.5 }],
  [['shrug'], { traps: 1, forearms: 0.3 }],
  [['muscle-up', 'muscle up'], { lats: 1, chest: 0.6, triceps: 0.7, biceps: 0.6 }],
  [['front lever', 'lever'], { lats: 1, abs: 0.8, rear_delts: 0.4 }],
  [['pull-up', 'pullup', 'pull up', 'chin', 'pulldown', 'lat pull'], { lats: 1, biceps: 0.6, rear_delts: 0.3, forearms: 0.3 }],
  [['row'], { lats: 0.9, traps: 0.6, rear_delts: 0.5, biceps: 0.5 }],
  [['romanian', 'rdl', 'good morning'], { hamstrings: 1, glutes: 0.8, lower_back: 0.6 }],
  [['deadlift'], { hamstrings: 0.8, glutes: 0.9, lower_back: 1, traps: 0.5, forearms: 0.5, quads: 0.4 }],
  [['hammer'], { biceps: 0.8, forearms: 0.8 }],
  [['curl'], { biceps: 1, forearms: 0.4 }],
  [['tricep', 'skull', 'pushdown', 'extension'], { triceps: 1 }],
  [['pistol'], { quads: 1, glutes: 0.7, calves: 0.3, abs: 0.3 }],
  [['leg press'], { quads: 1, glutes: 0.6 }],
  [['lunge', 'split squat'], { quads: 0.9, glutes: 0.8, hamstrings: 0.3 }],
  [['squat'], { quads: 1, glutes: 0.8, hamstrings: 0.3, lower_back: 0.3 }],
  [['calf'], { calves: 1 }],
  [['burpee'], { chest: 0.5, quads: 0.6, front_delts: 0.4, abs: 0.4, calves: 0.3 }],
  [['mountain climber'], { abs: 0.8, front_delts: 0.4, quads: 0.4, obliques: 0.4 }],
  [['jumping jack', 'skipping', 'jump rope', 'rope'], { calves: 0.8, quads: 0.3, side_delts: 0.2 }],
  [['run', 'jog', 'sprint'], { quads: 0.6, hamstrings: 0.6, calves: 0.8, glutes: 0.5 }],
  [['cycl', 'bike'], { quads: 0.9, glutes: 0.4, calves: 0.4, hamstrings: 0.3 }],
  [['walk'], { calves: 0.3, quads: 0.2, glutes: 0.2 }],
  [['l-sit', 'v-sit', 'l sit', 'v sit'], { abs: 1, quads: 0.4, triceps: 0.4 }],
  [['plank'], { abs: 0.9, obliques: 0.5, front_delts: 0.3 }],
  [['sit-up', 'situp', 'sit up', 'crunch', 'toe touch', 'leg raise'], { abs: 1, obliques: 0.5 }],
  [['twist', 'oblique', 'side bend'], { obliques: 1, abs: 0.4 }],
];

export function guessMuscles(name: string): MuscleWeights {
  const n = name.toLowerCase();
  for (const [keys, weights] of NAME_RULES) {
    if (keys.some((k) => n.includes(k))) return weights;
  }
  return {};
}

export const musclesFor = (item: { name?: string; label?: string; muscles?: MuscleWeights }): MuscleWeights =>
  item.muscles && Object.keys(item.muscles).length ? item.muscles : guessMuscles(item.name ?? item.label ?? '');

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// ── Effort model ────────────────────────────────────────────────────────────
// Load is counted in hard-set equivalents (HSE): one set taken to within ~3 reps of
// failure. Hypertrophy and fatigue research both count volume this way, so a set of 20
// easy curls counts for less than a grinding set of 5.

/** Share of a hard set by reps in reserve. */
export function rirFactor(rir: number): number {
  if (rir <= 3) return 1;
  if (rir <= 4) return 0.8;
  if (rir <= 5) return 0.6;
  if (rir <= 6) return 0.45;
  if (rir <= 7) return 0.35;
  return 0.25;
}

/** Assumed reps in reserve for a first-ever set, when there's no history to compare with. */
const FIRST_SET_RIR = 2;
/** Cardio: km or minutes per HSE when the exercise doesn't say. */
const CARDIO_PER_HSE = { km: 1.5, min: 12 } as const;
const DEFAULT_HARD_SET: Record<string, number> = { reps: 20, sec: 45, min: 12, km: 1.5 };

const epley = (kg: number, reps: number) => kg * (1 + reps / 30);

/**
 * Tracks bests per exercise in date order so each set's effort can be estimated
 * against what you could do at the time: 8 reps at 80% of your best 1RM is a hard
 * set, 8 reps at 50% isn't. An RPE on the set overrides the estimate.
 */
export class EffortModel {
  private best = new Map<string, number>();

  setHse(exId: string, unit: string, set: ExerciseSet): number {
    const rpe = num(set.rpe);
    const fromRpe = rpe ? rirFactor(10 - Math.min(10, rpe)) : null;
    switch (unit) {
      case 'kg': {
        const kg = num(set.v);
        const reps = num(set.reps);
        if (!reps) return 0;
        if (fromRpe !== null) return fromRpe;
        const best = this.best.get(exId);
        if (!best || !kg) return rirFactor(best ? Math.max(0, best - reps) : FIRST_SET_RIR);
        const repsToFailure = Math.max(reps, 30 * (best / kg - 1));
        return rirFactor(repsToFailure - reps);
      }
      case 'km':
        return num(set.v) / CARDIO_PER_HSE.km;
      case 'min':
        return num(set.v) / CARDIO_PER_HSE.min;
      default: {
        // reps, sec, stage: compare with your best single set.
        const v = unit === 'stage' ? num(set.seconds) : num(set.v);
        if (!v) return 0;
        if (fromRpe !== null) return fromRpe;
        const best = this.best.get(exId);
        if (!best) return rirFactor(FIRST_SET_RIR);
        // Holds have no reps; treat each tenth of your best as one rep in reserve.
        const rir = unit === 'reps' ? best - v : 10 * (1 - v / best);
        return rirFactor(Math.max(0, rir));
      }
    }
  }

  observe(exId: string, unit: string, set: ExerciseSet) {
    const v = unit === 'kg' ? (num(set.v) ? epley(num(set.v), num(set.reps)) : num(set.reps)) : unit === 'stage' ? num(set.seconds) : num(set.v);
    if (v > (this.best.get(exId) ?? 0)) this.best.set(exId, v);
  }
}

/** Quest tasks are a day's total, so effort is total ÷ one hard set's worth. */
export function questTaskHse(task: QuestTask, value: unknown): number {
  const v = num(value);
  if (!v) return 0;
  const per = task.hardSet ?? libraryExercise(task.id)?.hardSet ?? DEFAULT_HARD_SET[String(task.unit)] ?? 20;
  return v / per;
}

export type StatAxis = 'strength' | 'agility' | 'skill';

function axisFor(pattern: Pattern | undefined, unit: string): StatAxis {
  if (pattern === 'cardio' || pattern === 'conditioning' || unit === 'km' || unit === 'min') return 'agility';
  if (pattern === 'core' || pattern === 'mobility' || unit === 'stage') return 'skill';
  return 'strength';
}

export interface DayLoad {
  /** HSE per muscle, weighted by how much of the movement each muscle does. */
  muscles: Partial<Record<Muscle, number>>;
  questHse: number;
  trainingHse: number;
  axes: Record<StatAxis, number>;
}

const cache = new WeakMap<Logs, WeakMap<Template[], Record<DateStr, DayLoad>>>();

/** Per-day effort for every log, computed once per (logs, templates) pair. */
export function dayLoads(logs: Logs, templates: Template[]): Record<DateStr, DayLoad> {
  const hit = cache.get(logs)?.get(templates);
  if (hit) return hit;
  const model = new EffortModel();
  const out: Record<DateStr, DayLoad> = {};
  for (const date of Object.keys(logs).sort()) {
    const log = logs[date]!;
    const day: DayLoad = { muscles: {}, questHse: 0, trainingHse: 0, axes: { strength: 0, agility: 0, skill: 0 } };
    const add = (weights: MuscleWeights, hse: number) => {
      for (const [m, w] of Object.entries(weights) as [Muscle, number][]) day.muscles[m] = (day.muscles[m] ?? 0) + hse * w;
    };
    const sides = Object.values(log.side ?? {}).map((s) => ({ tasks: s!.quest.tasks, progress: s!.progress }));
    for (const { tasks, progress } of [{ tasks: log.dailyQuest?.tasks ?? [], progress: log.questProgress ?? {} }, ...sides]) {
      for (const task of tasks) {
        const hse = questTaskHse(task, progress[task.id]);
        if (!hse) continue;
        add(musclesFor(task), hse);
        day.questHse += hse;
        day.axes[axisFor(task.pattern ?? libraryExercise(task.id)?.pattern, String(task.unit))] += hse;
      }
    }
    const tpl = templates.find((t) => t.id === log.templateId);
    for (const ex of tpl?.exercises ?? []) {
      const unit = String(ex.unit);
      const sets = log.exLogs?.[ex.id]?.sets ?? [];
      // Score the whole session against bests from before it, then learn from it.
      const hse = sets.reduce((s, set) => s + model.setHse(ex.id, unit, set), 0);
      for (const set of sets) model.observe(ex.id, unit, set);
      if (!hse) continue;
      add(musclesFor(ex), hse);
      day.trainingHse += hse;
      day.axes[axisFor(undefined, unit)] += hse;
    }
    out[date] = day;
  }
  if (!cache.has(logs)) cache.set(logs, new WeakMap());
  cache.get(logs)!.set(templates, out);
  return out;
}

/** HSE per muscle for one day. */
export const logMuscleLoad = (logs: Logs, templates: Template[], date: DateStr) => dayLoads(logs, templates)[date]?.muscles ?? {};

/** When a session happened. v1 logs have no time, so assume early evening. */
function sessionTime(date: string, log: DailyLog): number {
  const stamp = log.trainingSavedAt ?? log.savedAt;
  if (stamp) {
    const t = Date.parse(stamp);
    // Back-filled logs are saved later than the day they describe; trust the date then.
    if (Number.isFinite(t) && new Date(t).toDateString() === parseDateStr(date).toDateString()) return t;
  }
  const d = parseDateStr(date);
  d.setHours(18, 0, 0, 0);
  return d.getTime();
}

/**
 * HSE at which a muscle reads ~63% fatigued. About six hard sets in one session is a
 * full day's work for a muscle; trained people tolerate a bit more.
 */
export const muscleCapacity = (tier = 0) => 6 * (1 + 0.08 * tier);
/** Ignore sessions older than this; their contribution has decayed to noise. */
const LOOKBACK_DAYS = 10;

/**
 * Current fatigue per muscle, 0–100. Each session's load decays exponentially with the
 * muscle's half-life (big muscles ~30 h, so a hard leg day is ~80% recovered after
 * 72 h), then saturates so one huge session can't exceed 100%.
 */
export function muscleFatigue(logs: Logs, templates: Template[], now: Date = new Date(), tier = 0): Record<Muscle, number> {
  const nowMs = now.getTime();
  const loads = dayLoads(logs, templates);
  const acc = Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const [date, log] of Object.entries(logs)) {
    const hours = (nowMs - sessionTime(date, log)) / 3_600_000;
    if (hours < 0 || hours > LOOKBACK_DAYS * 24) continue;
    const load = loads[date]?.muscles ?? {};
    for (const info of MUSCLES) {
      const l = load[info.id];
      if (l) acc[info.id] += l * 0.5 ** (hours / info.halfLife);
    }
  }
  const cap = muscleCapacity(tier);
  for (const m of MUSCLE_IDS) acc[m] = Math.round(100 * (1 - Math.exp(-acc[m] / cap)));
  return acc;
}

/** Mean of the three most loaded muscles: "how wrecked is the body right now". */
export function bodyFatigue(fatigue: Record<Muscle, number>): number {
  const top = Object.values(fatigue).sort((a, b) => b - a).slice(0, 3);
  return Math.round(top.reduce((s, v) => s + v, 0) / top.length);
}

export type MuscleState = 'fresh' | 'worked' | 'strained' | 'overloaded';

export function muscleState(pct: number): MuscleState {
  if (pct >= 80) return 'overloaded';
  if (pct >= 55) return 'strained';
  if (pct >= 25) return 'worked';
  return 'fresh';
}

/** Plain-language advice from the current map. */
export function recoveryAdvice(fatigue: Record<Muscle, number>): string {
  const label = (m: Muscle) => MUSCLES.find((x) => x.id === m)!.label;
  const tired = MUSCLE_IDS.filter((m) => fatigue[m] >= 55).sort((a, b) => fatigue[b] - fatigue[a]);
  const fresh = MUSCLE_IDS.filter((m) => fatigue[m] < 25);
  if (!tired.length) {
    const worked = MUSCLE_IDS.filter((m) => fatigue[m] >= 25).sort((a, b) => fatigue[b] - fatigue[a]);
    if (!worked.length) return 'All muscle groups are recovered. Any training type is fair game.';
    return `Nothing is strained. Most worked: ${worked.slice(0, 3).map(label).join(', ')}. Train freely, or favour other groups.`;
  }
  const rest = tired.slice(0, 3).map(label).join(', ');
  const train = fresh.slice(0, 3).map(label).join(', ');
  return train ? `Rest ${rest}. Ready to train: ${train}.` : `Rest ${rest}. Consider a recovery day.`;
}
