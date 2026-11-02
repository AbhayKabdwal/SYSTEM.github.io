import { addDays } from './dates';
import { isComplete } from './completion';
import type { DailyLog, DateStr, Logs, Template } from './types';

export const EXP = {
  questCleared: 100,
  penaltyBonus: 50,
  perSet: 5,
  trainingCap: 150,
  /** Per day of running streak, capped. */
  streakStep: 10,
  streakCap: 100,
} as const;

/** EXP per rank-ladder point. Ladder thresholds stay as in v1, ×100. */
export const EXP_PER_RANK_POINT = EXP.questCleared;

export const rankThresholdExp = (min: number) => min * EXP_PER_RANK_POINT;

function loggedSets(log: DailyLog, templates: Template[]): number {
  const tpl = templates.find((t) => t.id === log.templateId);
  if (!tpl) return 0;
  return tpl.exercises.reduce(
    (n, ex) =>
      n + (log.exLogs?.[ex.id]?.sets ?? []).filter((s) => Number(s.v) > 0 || Number(s.reps) > 0 || Number(s.seconds) > 0).length,
    0,
  );
}

export interface DayExp {
  quest: number;
  penalty: number;
  training: number;
  streak: number;
  total: number;
}

/** EXP earned on one day. `streakBefore` = consecutive cleared days ending the day before. */
export function dayExp(log: DailyLog | undefined, templates: Template[], streakBefore: number): DayExp {
  if (!log) return { quest: 0, penalty: 0, training: 0, streak: 0, total: 0 };
  const cleared = isComplete(log);
  const quest = cleared ? EXP.questCleared : 0;
  const penalty = cleared && log.penaltyAttempt ? EXP.penaltyBonus : 0;
  const training = Math.min(loggedSets(log, templates) * EXP.perSet, EXP.trainingCap);
  const streak = cleared ? Math.min((streakBefore + 1) * EXP.streakStep, EXP.streakCap) : 0;
  return { quest, penalty, training, streak, total: quest + penalty + training + streak };
}

/** Walks history in date order so each day's streak bonus is what it was on that day. */
export function totalExp(logs: Logs, templates: Template[]): number {
  let total = 0;
  let streak = 0;
  let prev: DateStr | null = null;
  for (const date of Object.keys(logs).sort()) {
    const log = logs[date]!;
    if (prev && addDays(prev, 1) !== date) streak = 0;
    total += dayExp(log, templates, streak).total;
    streak = isComplete(log) ? streak + 1 : 0;
    prev = date;
  }
  return total;
}

export function streakBefore(logs: Logs, date: DateStr): number {
  let s = 0;
  let d = addDays(date, -1);
  while (isComplete(logs[d]) && s < 365) {
    s++;
    d = addDays(d, -1);
  }
  return s;
}
