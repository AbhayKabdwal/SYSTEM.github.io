import type { DailyLog, Quest } from './types';

/** Every task hit its target. A quest with no tasks is never done. */
export function questDone(quest: Quest | undefined, progress: Record<string, string | number> | undefined): boolean {
  const tasks = quest?.tasks;
  if (!tasks?.length) return false;
  return tasks.every((t) => Number(progress?.[t.id] ?? 0) >= t.target);
}

/**
 * A day counts as cleared only if it has a quest and every task hit its target.
 * v1 treated a log with no quest as complete, so imported or partial logs inflated streaks.
 */
export const isComplete = (log: DailyLog | undefined): boolean => questDone(log?.dailyQuest, log?.questProgress);
