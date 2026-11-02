import { RANKS } from './defaults';
import { addDays } from './dates';
import { isComplete } from './completion';
import type { DateStr, Logs, Rank } from './types';

const MONTHLY_TARGET = 30;
const STREAK_LOOKBACK_DAYS = 365;

/**
 * Rank progress counts cleared quest days. v1 counted every saved log,
 * so saving an empty day or back-filling past dates raised your rank.
 */
export function countCleared(logs: Logs): number {
  return Object.values(logs).filter(isComplete).length;
}

export interface RankInfo extends Rank {
  next: Rank | null;
  /** 0–100 progress toward `next`. */
  prog: number;
}

export function getRank(total: number): RankInfo {
  let r = RANKS[0]!;
  for (const rr of RANKS) {
    if (total >= rr.min) r = rr;
    else break;
  }
  const next = RANKS.find((rr) => rr.min > total) ?? null;
  const prog = next ? Math.min(((total - r.min) / (next.min - r.min)) * 100, 100) : 100;
  return { ...r, next, prog };
}

/**
 * Consecutive cleared days ending today, or ending yesterday if today is still open.
 * v1 returned 0 all day until today's quest was done.
 */
export function getStreak(logs: Logs, today: DateStr): number {
  let d = isComplete(logs[today]) ? today : addDays(today, -1);
  let s = 0;
  for (let i = 0; i < STREAK_LOOKBACK_DAYS && isComplete(logs[d]); i++) {
    s++;
    d = addDays(d, -1);
  }
  return s;
}

/** Penalty applies if the last logged day before today was missed, or there is a gap. */
export function isPenalty(logs: Logs, today: DateStr): boolean {
  const todayLog = logs[today];
  if (todayLog?.penaltyAttempt && !isComplete(todayLog)) return true;
  const before = Object.keys(logs)
    .filter((d) => d < today)
    .sort();
  const last = before[before.length - 1];
  if (!last) return false;
  return last < addDays(today, -1) || !isComplete(logs[last]);
}

export function getMonthly(logs: Logs, today: DateStr) {
  const month = today.slice(0, 7);
  const done = Object.entries(logs).filter(([d, l]) => d.startsWith(month) && isComplete(l)).length;
  return { done, target: MONTHLY_TARGET, unlocked: done >= MONTHLY_TARGET };
}
