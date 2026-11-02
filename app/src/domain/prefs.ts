import { LIBRARY, type LibraryExercise } from './library';
import type { Equipment, Pattern, Preferences } from './types';

export const DEFAULT_PREFS: Omit<Preferences, 'pool'> = {
  goals: ['strength'],
  equipment: [],
  experience: 'beginner',
  minutes: 30,
  limits: [],
  focus: 'balanced',
};

/** Whether this person can do the exercise at all: equipment on hand, no flagged joint. */
export function fits(ex: LibraryExercise, prefs: Pick<Preferences, 'equipment' | 'limits'>): boolean {
  const owned = new Set<Equipment>(prefs.equipment);
  if (ex.equip && !ex.equip.some((e) => owned.has(e) || (owned.has('gym') && e !== 'jump_rope'))) return false;
  if (ex.avoid?.some((l) => prefs.limits.includes(l))) return false;
  return true;
}

/**
 * Starting quest pool from calibration answers: everything that fits, minus
 * exercises that serve none of the chosen goals. Each pattern keeps at least
 * one fitting exercise so the ladder never has gaps.
 */
export function buildPool(prefs: Omit<Preferences, 'pool'>): string[] {
  const fitting = LIBRARY.filter((e) => e.pattern !== 'mobility' && fits(e, prefs));
  const goals = new Set(prefs.goals.length ? prefs.goals : DEFAULT_PREFS.goals);
  const chosen = new Set(fitting.filter((e) => e.goals.some((g) => goals.has(g))).map((e) => e.id));
  const patterns = new Set<Pattern>(fitting.map((e) => e.pattern));
  for (const p of patterns) {
    if (![...chosen].some((id) => LIBRARY.find((e) => e.id === id)!.pattern === p)) {
      for (const e of fitting.filter((x) => x.pattern === p)) chosen.add(e.id);
    }
  }
  return LIBRARY.filter((e) => chosen.has(e.id)).map((e) => e.id);
}

export const GOAL_LABEL = {
  strength: 'Strength',
  muscle: 'Build muscle',
  endurance: 'Endurance',
  fat_loss: 'Lose fat',
  skills: 'Calisthenics skills',
} as const;

export const EQUIPMENT_LABEL = {
  pullup_bar: 'Pull-up bar',
  dumbbells: 'Dumbbells',
  jump_rope: 'Jump rope',
  gym: 'Full gym',
} as const;

export const LIMIT_LABEL = {
  knees: 'Knees',
  wrists: 'Wrists',
  lower_back: 'Lower back',
  shoulders: 'Shoulders',
} as const;
