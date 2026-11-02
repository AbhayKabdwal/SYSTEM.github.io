import { isComplete } from './completion';
import type { DateStr, Logs } from './types';

export const DELOAD_THRESHOLD = 45;
const WINDOW = 7;
const MAX_FROM_MISSES = 60;

/**
 * v1 "fatigue": share of missed quests in the last 7 logged days, scaled to 0–60.
 * This measures compliance, not physical load. Phase 2 replaces it with a
 * per-muscle model (muscles.ts) for body load; this one still drives deload quests.
 * Pass `today` so an unfinished quest for today doesn't count as a miss yet.
 */
export function getFatigue(logs: Logs, today?: DateStr): number {
  const recent = Object.entries(logs)
    .filter(([d, l]) => !(d === today && !isComplete(l)))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, WINDOW);
  if (!recent.length) return 0;
  const missed = recent.filter(([, l]) => !isComplete(l)).length;
  return Math.min(100, Math.round((missed / recent.length) * MAX_FROM_MISSES));
}

export type FatigueBand = 'optimal' | 'moderate' | 'deload';

export function fatigueBand(fatigue: number): FatigueBand {
  if (fatigue >= DELOAD_THRESHOLD) return 'deload';
  if (fatigue >= 25) return 'moderate';
  return 'optimal';
}
