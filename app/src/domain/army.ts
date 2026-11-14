import type { DateStr } from './types';

// Shadows extracted from great efforts. Names are deterministic per source and date.

export type ShadowSource = 'perfect_week' | 'dungeon' | 'trial';

export interface Shadow {
  id: string;
  name: string;
  rank: string;
  source: ShadowSource;
  date: DateStr;
  wounded: boolean;
}

const FIRST = ['Iron', 'Ash', 'Night', 'Storm', 'Ember', 'Frost', 'Grave', 'Hollow', 'Crimson', 'Silent', 'Raven', 'Thorn', 'Obsidian', 'Gale', 'Dusk', 'Vigil'];
const SECOND = ['fang', 'blade', 'shade', 'warden', 'reaver', 'knight', 'stalker', 'guard', 'howl', 'spear', 'veil', 'hand', 'crow', 'brand', 'wraith', 'keeper'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function shadowName(seed: string) {
  const h = hash(seed);
  return `${FIRST[h % FIRST.length]}${SECOND[(h >>> 8) % SECOND.length]}`;
}

export const SOURCE_LABEL: Record<ShadowSource, string> = {
  perfect_week: 'Perfect week',
  dungeon: 'Dungeon clear',
  trial: 'Rank-up trial',
};

// ── Items ──

export type ItemKind = 'shield' | 'elixir' | 'scroll';

export const ITEMS: Record<ItemKind, { name: string; icon: string; text: string; source: string }> = {
  shield: { name: 'Streak Shield', icon: '🛡', text: 'Used automatically on a missed day: no penalty, streak kept.', source: 'Streak milestones (14, 30, 60, 100…)' },
  elixir: { name: 'Rest Elixir', icon: '⚗', text: 'Used automatically for a second rest day in the same week.', source: 'Every second dungeon clear' },
  scroll: { name: 'EXP Scroll', icon: '📜', text: 'Use on a day to double its quest and training EXP.', source: 'Perfect weeks' },
};

export type Inventory = Record<ItemKind, number>;
