// Features open up as the player levels, so a new hunter starts with just the essentials.

export type Feature = 'body' | 'stats' | 'items' | 'dungeons' | 'shadows' | 'hunters' | 'skills' | 'records' | 'reports' | 'boss' | 'job';

export interface Unlock {
  feature: Feature;
  level: number;
  name: string;
  /** Shown in the unlock notification. */
  blurb: string;
}

export const UNLOCKS: Unlock[] = [
  { feature: 'body', level: 2, name: 'Muscle Map', blurb: 'See how fatigued each muscle is and what is ready to train.' },
  { feature: 'stats', level: 2, name: 'Stat Points', blurb: 'Each level gives 3 stat points. Spend them to steer your quests.' },
  { feature: 'records', level: 3, name: 'Personal Records', blurb: 'Your best reps, holds and lifts, with alerts when you beat them.' },
  { feature: 'items', level: 3, name: 'Inventory', blurb: 'Streak Shields, Rest Elixirs and EXP Scrolls earned from milestones.' },
  { feature: 'dungeons', level: 4, name: 'Instant Dungeons', blurb: 'A weekly boss run for big EXP. Skip one and the next gate breaks open harder.' },
  { feature: 'shadows', level: 4, name: 'Shadow Army', blurb: 'Perfect weeks, dungeons and trials extract shadows that follow you.' },
  { feature: 'reports', level: 4, name: 'Weekly Report', blurb: 'Every Monday the System reviews your week.' },
  { feature: 'hunters', level: 5, name: 'Hunters Network', blurb: 'Guilds, duels, leagues and the feed.' },
  { feature: 'boss', level: 5, name: 'Monthly Boss', blurb: 'Every hunter’s hard sets damage one shared boss.' },
  { feature: 'skills', level: 6, name: 'Mastery Trees', blurb: 'Calisthenics skill progressions from frog stand to full planche.' },
  { feature: 'job', level: 40, name: 'Job Change', blurb: 'Choose your class: Fighter, Assassin or Mage.' },
];

export const isUnlocked = (feature: Feature, level: number) => level >= (UNLOCKS.find((u) => u.feature === feature)?.level ?? 1);

export const unlockFor = (feature: Feature) => UNLOCKS.find((u) => u.feature === feature)!;

/** Unlocks reached at this level that the player hasn't been shown yet. */
export const newUnlocks = (level: number, seen: Feature[]) => UNLOCKS.filter((u) => level >= u.level && !seen.includes(u.feature));
