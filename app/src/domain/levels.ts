import { RANKS } from './defaults';
import type { Rank } from './types';

/** Level a rank band starts at, and its colour. Index = tier (0 = E … 5 = S). */
export const RANK_GATES = [
  { rank: 'E', level: 1, color: '#778899' },
  { rank: 'D', level: 10, color: '#4499ff' },
  { rank: 'C', level: 20, color: '#44ffaa' },
  { rank: 'B', level: 35, color: '#bb44ff' },
  { rank: 'A', level: 50, color: '#ff8844' },
  { rank: 'S', level: 70, color: '#ffdd00' },
] as const;

export const MAX_LEVEL = 100;

/**
 * Total EXP to reach a level. Quadratic, tuned against ~180 EXP/day at E-rank rising
 * to ~500 at S: D-rank after ~4 weeks of daily quests, C ~3 months, B ~6 months,
 * A ~1 year, S ~1.5 years, level 100 ~3 years.
 */
export const expForLevel = (level: number) => {
  const l = Math.max(0, Math.min(MAX_LEVEL, level) - 1);
  return 40 * l * l + 60 * l;
};

export function levelFor(exp: number): number {
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (expForLevel(mid) <= exp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function titleFor(level: number): Rank {
  let r = RANKS[0]!;
  for (const rr of RANKS) if (level >= rr.min) r = rr;
  return r;
}

/** Highest rank band a level qualifies for (before trials). */
export function tierForLevel(level: number): number {
  let t = 0;
  RANK_GATES.forEach((g, i) => {
    if (level >= g.level) t = i;
  });
  return t;
}
