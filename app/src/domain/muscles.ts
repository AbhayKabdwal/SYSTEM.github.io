import { parseDateStr } from './dates';
import type { DailyLog, ExerciseSet, Logs, Muscle, MuscleWeights, QuestTask, Template } from './types';

export interface MuscleInfo {
  id: Muscle;
  label: string;
  /** Hours for accumulated load to halve. Big muscles recover slower. */
  halfLife: number;
}

export const MUSCLES: MuscleInfo[] = [
  { id: 'chest', label: 'Chest', halfLife: 40 },
  { id: 'front_delts', label: 'Front Delts', halfLife: 30 },
  { id: 'side_delts', label: 'Side Delts', halfLife: 28 },
  { id: 'rear_delts', label: 'Rear Delts', halfLife: 28 },
  { id: 'biceps', label: 'Biceps', halfLife: 30 },
  { id: 'triceps', label: 'Triceps', halfLife: 30 },
  { id: 'forearms', label: 'Forearms', halfLife: 24 },
  { id: 'abs', label: 'Abs', halfLife: 24 },
  { id: 'obliques', label: 'Obliques', halfLife: 24 },
  { id: 'lats', label: 'Lats', halfLife: 40 },
  { id: 'traps', label: 'Traps', halfLife: 32 },
  { id: 'lower_back', label: 'Lower Back', halfLife: 48 },
  { id: 'glutes', label: 'Glutes', halfLife: 44 },
  { id: 'quads', label: 'Quads', halfLife: 48 },
  { id: 'hamstrings', label: 'Hamstrings', halfLife: 48 },
  { id: 'calves', label: 'Calves', halfLife: 24 },
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

/**
 * Work units for one set, roughly "1 unit = 10 bodyweight reps".
 * 100 push-ups ≈ 10 units; one set of 8 at 60 kg ≈ 3.2 units; 3 km run ≈ 9 units.
 */
export function setLoad(unit: string, set: ExerciseSet): number {
  switch (unit) {
    case 'kg':
      return (num(set.reps) * (1 + num(set.v) / 20)) / 10;
    case 'km':
      return num(set.v) * 3;
    case 'min':
      return num(set.v) * 0.6;
    case 'sec':
      return num(set.v) / 20;
    case 'stage':
      return num(set.seconds) / 15;
    default: // reps
      return num(set.v) / 10;
  }
}

export const questTaskLoad = (task: QuestTask, value: unknown) => setLoad(String(task.unit), { v: num(value) });

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

/** Raw work units per muscle for one day's log. */
export function logMuscleLoad(log: DailyLog, templates: Template[]): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  const add = (weights: MuscleWeights, units: number) => {
    if (!units) return;
    for (const [m, w] of Object.entries(weights) as [Muscle, number][]) out[m] = (out[m] ?? 0) + units * w;
  };
  for (const task of log.dailyQuest?.tasks ?? []) {
    add(musclesFor(task), questTaskLoad(task, log.questProgress?.[task.id]));
  }
  const tpl = templates.find((t) => t.id === log.templateId);
  for (const ex of tpl?.exercises ?? []) {
    const units = (log.exLogs?.[ex.id]?.sets ?? []).reduce((s, set) => s + setLoad(String(ex.unit), set), 0);
    add(musclesFor(ex), units);
  }
  return out;
}

/**
 * Load at which a muscle reads ~63% fatigued. Tuned so one daily quest reads "worked"
 * (~25–35%), a full gym session on a muscle "strained", and several hard days in a row
 * without rest "overloaded".
 */
const CAPACITY = 40;
/** Ignore sessions older than this; their contribution has decayed to noise. */
const LOOKBACK_DAYS = 10;

/**
 * Current fatigue per muscle, 0–100. Each session's load decays exponentially with the
 * muscle's half-life, then saturates so one huge session can't exceed 100%.
 */
export function muscleFatigue(logs: Logs, templates: Template[], now: Date = new Date()): Record<Muscle, number> {
  const nowMs = now.getTime();
  const acc = Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const [date, log] of Object.entries(logs)) {
    const t = sessionTime(date, log);
    const hours = (nowMs - t) / 3_600_000;
    if (hours < 0 || hours > LOOKBACK_DAYS * 24) continue;
    const load = logMuscleLoad(log, templates);
    for (const info of MUSCLES) {
      const l = load[info.id];
      if (l) acc[info.id] += l * 0.5 ** (hours / info.halfLife);
    }
  }
  for (const m of MUSCLE_IDS) acc[m] = Math.round(100 * (1 - Math.exp(-acc[m] / CAPACITY)));
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
