import { addDays } from '../domain';
import type { Ledger } from '../domain';
import { DUEL_DAYS, type Duel } from './competition';

/** Your Effort Points inside a duel's 7-day window, from your own ledger. */
export function duelScore(ledger: Ledger, duel: Duel): number {
  if (!duel.starts_on) return 0;
  let s = 0;
  for (let i = 0; i < DUEL_DAYS; i++) s += ledger.days[addDays(duel.starts_on, i)]?.ep ?? 0;
  return s;
}

export type DuelPhase = 'waiting' | 'upcoming' | 'live' | 'settling' | 'over' | 'closed';

/** Scores stay open two days after the end so both sides can report. */
export function duelPhase(duel: Duel, today: string): DuelPhase {
  if (duel.status === 'pending') return 'waiting';
  if (duel.status !== 'active' || !duel.starts_on) return 'closed';
  const end = addDays(duel.starts_on, DUEL_DAYS - 1);
  if (today < duel.starts_on) return 'upcoming';
  if (today <= end) return 'live';
  if (today <= addDays(end, 2)) return 'settling';
  return 'over';
}
