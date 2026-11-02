import type { DailyLog } from './types';

/**
 * A day counts as cleared only if it has a quest and every task hit its target.
 * v1 treated a log with no quest as complete, so imported or partial logs inflated streaks.
 */
export function isComplete(log: DailyLog | undefined): boolean {
  const tasks = log?.dailyQuest?.tasks;
  if (!tasks?.length) return false;
  const progress = log?.questProgress ?? {};
  return tasks.every((t) => Number(progress[t.id] ?? 0) >= t.target);
}
