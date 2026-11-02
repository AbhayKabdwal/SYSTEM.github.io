// Shapes match the v1 localStorage / JSON backup format so existing data imports as-is.

/** Local calendar date, `YYYY-MM-DD`. */
export type DateStr = string;

export type QuestUnit = 'min' | 'reps' | 'km' | 'sec';
export type ExerciseUnit = 'kg' | 'reps' | 'km' | 'min' | 'sec' | 'stage';

export interface QuestTask {
  id: string;
  label: string;
  target: number;
  unit: QuestUnit | string;
}

export interface Quest {
  name: string;
  tasks: QuestTask[];
}

export interface Exercise {
  id: string;
  name: string;
  unit: ExerciseUnit | string;
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
  photos?: (string | null)[];
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
