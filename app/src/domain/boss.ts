import { addDays } from './dates';
import type { Ledger } from './ledger';
import type { DateStr, Logs, Template } from './types';
import { dayLoads } from './muscles';

// The monthly boss: every hunter's verified hard sets damage one shared HP bar.

const BOSSES = [
  'Vorgath the Frost Tyrant',
  'Maelis, Queen of Ash',
  'The Iron Colossus',
  'Skarn the Bone Warden',
  'Nyxara of the Hollow Moon',
  'Grumhal the Mountain',
  'The Crimson Hydra',
  'Oryx, Lord of Storms',
  'Thessaly the Thornmother',
  'The Gatekeeper Below',
  'Kael, the Shadow Regent',
  'The Last Monarch',
];

/** `YYYY-MM` of a date string. */
export const monthOf = (d: string) => d.slice(0, 7);

export function bossFor(month: string) {
  const [y, m] = month.split('-').map(Number);
  const name = BOSSES[((y! * 12 + m!) % BOSSES.length + BOSSES.length) % BOSSES.length]!;
  return { name };
}

/** HP scales with how many hunters joined, so a small community can still win. */
export const bossHp = (participants: number) => 400 * Math.max(1, participants);

/** Your contribution: hard sets from verified days this month, capped per day so it can't be farmed. */
export const DAILY_DAMAGE_CAP = 25;


/** This month's damage: hard sets on verified days, at most DAILY_DAMAGE_CAP a day. */
export function monthDamage(ledger: Ledger, logs: Logs, templates: Template[], today: DateStr): number {
  const loads = dayLoads(logs, templates);
  const month = monthOf(today);
  let dmg = 0;
  for (let d = `${month}-01`; d <= today; d = addDays(d, 1)) {
    if (ledger.days[d]?.status !== 'verified') continue;
    const l = loads[d];
    dmg += Math.min(DAILY_DAMAGE_CAP, Math.round((l?.questHse ?? 0) + (l?.trainingHse ?? 0)));
  }
  return dmg;
}
