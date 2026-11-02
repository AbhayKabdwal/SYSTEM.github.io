// Shapes match the v1 localStorage / JSON backup format so existing data imports as-is.

/** Local calendar date, `YYYY-MM-DD`. */
export type DateStr = string;

export type QuestUnit = 'min' | 'reps' | 'km' | 'sec';
export type ExerciseUnit = 'kg' | 'reps' | 'km' | 'min' | 'sec' | 'stage';

export type Muscle =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'lats' | 'traps' | 'lower_back' | 'glutes' | 'quads' | 'hamstrings' | 'calves';

/** Share of an exercise's work each muscle takes: 1 = primary mover, ~0.5 = secondary. */
export type MuscleWeights = Partial<Record<Muscle, number>>;

export interface QuestTask {
  id: string;
  label: string;
  target: number;
  unit: QuestUnit | string;
  muscles?: MuscleWeights;
}

export interface Quest {
  name: string;
  tasks: QuestTask[];
}

export interface Exercise {
  id: string;
  name: string;
  unit: ExerciseUnit | string;
  /** Overrides the name-based guess in muscles.ts. */
  muscles?: MuscleWeights;
}

export interface Template {
  id: string;
  name: string;
  color: string;
  exercises: Exercise[];
}

/** `v` is weight, distance, count or a skill-stage label depending on the exercise unit. */
export interface ExerciseSet {
  v?: string | number;
  reps?: string | number;
  seconds?: string | number;
}

export interface Recovery {
  water: number;
  creatine: boolean;
}

export interface DailyLog {
  questProgress?: Record<string, string | number>;
  recovery?: Recovery;
  dailyQuest?: Quest;
  penaltyAttempt?: boolean;
  penaltyCleared?: boolean;
  savedAt?: string;
  /** v1 only: inline JPEG data URLs. Converted to `photoIds` on import. */
  photos?: (string | null)[];
  /** Front / side / back photo ids in the device-only photo store. */
  photoIds?: (string | null)[];
  templateId?: string;
  exLogs?: Record<string, { sets?: ExerciseSet[] }>;
  trainingSavedAt?: string;
}

export type Logs = Record<DateStr, DailyLog>;

export interface Player {
  name: string;
  /** Legacy field: v1 stored the count of saved days here. Derive rank from logs instead. */
  totalWorkouts?: number;
  createdAt?: string;
  /** Daily water target in glasses. */
  waterTarget?: number;
}

export interface Rank {
  min: number;
  level: number;
  rank: string;
  title: string;
  color: string;
}

export interface SkillNode {
  id: string;
  label: string;
  req: number;
  deps?: string[];
}

export interface SkillTree {
  id: string;
  name: string;
  nodes: SkillNode[];
}
