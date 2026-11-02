import { isComplete } from './completion';
import type { DateStr, Logs } from './types';

const MONTHLY_TARGET = 30;

/**
 * Cleared quest days. v1 counted every saved log, so saving an empty day or
 * back-filling past dates raised your rank.
 */
export function countCleared(logs: Logs): number {
  return Object.values(logs).filter(isComplete).length;
}

export function getMonthly(logs: Logs, today: DateStr) {
  const month = today.slice(0, 7);
  const done = Object.entries(logs).filter(([d, l]) => d.startsWith(month) && isComplete(l)).length;
  return { done, target: MONTHLY_TARGET, unlocked: done >= MONTHLY_TARGET };
}
