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

export type Pattern = 'push' | 'pull' | 'squat' | 'hinge' | 'core' | 'cardio' | 'conditioning' | 'mobility';

export interface QuestTask {
  id: string;
  label: string;
  target: number;
  unit: QuestUnit | string;
  muscles?: MuscleWeights;
  /** Library quests: movement pattern, and how many units make one hard set (for fatigue). */
  pattern?: Pattern;
  hardSet?: number;
}

export type QuestKind = 'daily' | 'penalty' | 'recovery' | 'trial' | 'dungeon';

export interface Quest {
  name: string;
  tasks: QuestTask[];
  /** Absent on v1 quests, which were all daily random gates. */
  kind?: QuestKind;
  /** Rank tier (0 = E … 5 = S) the quest was generated for. */
  tier?: number;
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
  /** Optional effort, 1–10. Without it, effort is estimated from your recent bests. */
  rpe?: string | number;
}

export interface Recovery {
  water: number;
  creatine: boolean;
}

export type Visibility = 'private' | 'followers' | 'public';

/** Photo proof of the day's workout. Private proofs never leave the device. */
export interface Proof {
  photoId: string;
  /** When the photo was attached. Proof only counts on the day it was taken. */
  at: string;
  visibility: Visibility;
  /** Set when the proof was also posted to the Hunters feed. */
  featId?: string;
}

export type SideQuestKind = 'trial' | 'dungeon';

export interface SideQuest {
  quest: Quest;
  progress: Record<string, string | number>;
  /** Trials: the rank being tested for. */
  rank?: string;
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
  /** Declared rest day. One per Monday–Sunday week keeps the streak alive. */
  rest?: boolean;
  proof?: Proof;
  side?: Partial<Record<SideQuestKind, SideQuest>>;
}

export type Logs = Record<DateStr, DailyLog>;

export interface Player {
  name: string;
  /** Legacy field: v1 stored the count of saved days here. Derive rank from logs instead. */
  totalWorkouts?: number;
  createdAt?: string;
  /** Daily water target in glasses. */
  waterTarget?: number;
  /** Set by System calibration: drives which exercises appear in quests. */
  prefs?: Preferences;
  /**
   * First day the v2 rules (proof, rest days, penalties) apply. Days before it are
   * scored by the old rules, so migrated history isn't retroactively penalised.
   */
  rulesSince?: DateStr;
  /** Publish level, rank and streak on your profile for leaderboards. */
  shareStats?: boolean;
}

export type Goal = 'strength' | 'muscle' | 'endurance' | 'fat_loss' | 'skills';
export type Equipment = 'pullup_bar' | 'dumbbells' | 'jump_rope' | 'gym';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Limitation = 'knees' | 'wrists' | 'lower_back' | 'shoulders';
export type Focus = 'balanced' | 'upper' | 'lower' | 'core';

export interface Preferences {
  goals: Goal[];
  equipment: Equipment[];
  experience: Experience;
  /** Minutes per day for the daily quest. */
  minutes: 15 | 30 | 45 | 60;
  limits: Limitation[];
  focus: Focus;
  /** Library exercise ids the daily quest draws from. */
  pool: string[];
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
