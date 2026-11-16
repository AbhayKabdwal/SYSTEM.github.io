// Features open up as the player levels, so a new hunter starts with just the essentials.

export type Feature = 'body' | 'stats' | 'items' | 'dungeons' | 'shadows' | 'hunters' | 'skills' | 'records' | 'reports' | 'boss' | 'job';

export interface Unlock {
  feature: Feature;
  level: number;
  name: string;
  /** Shown in the unlock notification. */
  blurb: string;
  icon: string;
  /** Where "Show me" goes: a route, or a Status page section to open. */
  to: string;
  /** What it does, how to use it, and a tip. Short lines, shown as a list. */
  guide: string[];
}

export const UNLOCKS: Unlock[] = [
  {
    feature: 'body', level: 2, name: 'Muscle Map', icon: '⚇', to: '/body',
    blurb: 'See how fatigued each muscle is and what is ready to train.',
    guide: [
      'Every set and quest task adds load to the muscles it works. Colours show how tired each one is right now.',
      'Load fades over time: legs take about three days to recover from a hard session, arms and calves less.',
      'Tap a muscle to see its recent load. Train the green and blue ones; rest the red ones.',
    ],
  },
  {
    feature: 'stats', level: 2, name: 'Stat Points', icon: '◈', to: 'stats',
    blurb: 'Each level gives 3 stat points. Spend them to steer your quests.',
    guide: [
      'STR, AGI, VIT, SEN and INT grow by themselves from what you train. Stat points are extra you choose.',
      'Points in STR bring more push, pull and leg work; AGI more cardio; SEN more core and control; VIT a little more volume.',
      'You can move points back at any time. Open STATS on the Status page.',
    ],
  },
  {
    feature: 'records', level: 3, name: 'Personal Records', icon: '★', to: '/records',
    blurb: 'Your best reps, holds and lifts, with alerts when you beat them.',
    guide: [
      'Every best set and best quest day is kept, with the date you set it.',
      'Beat one and the System tells you right after you save.',
      'Find them under More → Personal Records.',
    ],
  },
  {
    feature: 'items', level: 3, name: 'Inventory', icon: '⚱', to: 'inventory',
    blurb: 'Streak Shields, Rest Elixirs and EXP Scrolls earned from milestones.',
    guide: [
      'Streak Shield: absorbs one missed day automatically. Earned at streak milestones (14, 30, 60…).',
      'Rest Elixir: allows a second rest day in a week. Found in every second dungeon.',
      'EXP Scroll: doubles one day’s EXP when you choose to use it. Found after a perfect week.',
      'You can carry 3 shields, 3 elixirs and 5 scrolls, so use them.',
    ],
  },
  {
    feature: 'dungeons', level: 4, name: 'Instant Dungeons', icon: '⚔', to: '/quest',
    blurb: 'A weekly boss run for big EXP. Skip one and the next gate breaks open harder.',
    guide: [
      'Once a week an optional dungeon appears on the Quest page: five exercises at higher volume.',
      'Clear it for a large EXP reward and a new shadow for your army.',
      'Ignore it for a week and the next one becomes a Dungeon Break: harder, but it pays 50% more.',
    ],
  },
  {
    feature: 'shadows', level: 4, name: 'Shadow Army', icon: '♟', to: 'army',
    blurb: 'Perfect weeks, dungeons and trials extract shadows that follow you.',
    guide: [
      'A perfect week (7 of 7 verified, no rest), a dungeon clear or a rank-up trial each extracts a shadow.',
      'A week with a missed day wounds your newest shadow. The next perfect week heals the whole army.',
    ],
  },
  {
    feature: 'reports', level: 4, name: 'Weekly Report', icon: '▤', to: '/report',
    blurb: 'Every Monday the System reviews your week.',
    guide: [
      'A grade from S to E for each Monday–Sunday week, with your most and least trained muscles.',
      'One focus tip for the week ahead.',
      'Share it as an image with SHARE AS IMAGE.',
    ],
  },
  {
    feature: 'hunters', level: 5, name: 'Hunters Network', icon: '♜', to: '/hunters',
    blurb: 'Guilds, duels, leagues and the feed.',
    guide: [
      'Feed: share feats with followers or everyone, follow hunters and like their posts. Private feats never leave your phone.',
      'League: a weekly board scored by Effort Points, so every rank competes fairly. The top 20% move up each Monday.',
      'Guilds: join with an invite code, chase a shared weekly goal and keep a guild streak.',
      'Duels: challenge a hunter from their profile; most Effort Points in 7 days wins.',
      'Needs an account. Turn on Share stats in Account to appear on boards.',
    ],
  },
  {
    feature: 'boss', level: 5, name: 'Monthly Boss', icon: '☠', to: 'boss',
    blurb: 'Every hunter’s hard sets damage one shared boss.',
    guide: [
      'Each month a new boss appears with a shared HP bar.',
      'Every verified hard set you do deals 1 damage (up to 25 a day).',
      'Tap JOIN THE HUNT on the Status page. Only your damage total is shared.',
    ],
  },
  {
    feature: 'skills', level: 6, name: 'Mastery Trees', icon: '⌬', to: 'skills',
    blurb: 'Calisthenics skill progressions from frog stand to full planche.',
    guide: [
      'Six skill trees: Planche, Front Lever, Muscle-up, HSPU, Pistol and L-Sit.',
      'Tap LOG SKILL WORK, pick the stage you trained and enter your hold time or reps.',
      'Reach a stage’s target to unlock the next one.',
    ],
  },
  {
    feature: 'job', level: 40, name: 'Job Change', icon: '♛', to: '/quest',
    blurb: 'Choose your class: Fighter, Assassin or Mage.',
    guide: [
      'At level 40 a Job Change quest appears. Clear it on three separate days.',
      'Then choose a class: Fighter (strength), Assassin (agility) or Mage (sense).',
      'Your class adds +5 to its stat and steers which exercises appear. It can’t be changed.',
    ],
  },
];

/** The basics, explained once at the start and always in the Guide. */
export const BASICS: { icon: string; name: string; guide: string[] }[] = [
  {
    icon: '⊕',
    name: 'Daily quest',
    guide: [
      'Every day the System assigns a quest built from your calibration. It gets harder as you rank up.',
      'Clear every task, then add a photo as proof. Without proof you keep half the EXP and your streak doesn’t grow.',
    ],
  },
  {
    icon: '🔥',
    name: 'Streaks and rest',
    guide: [
      'Each verified day adds to your streak and your EXP multiplier.',
      'One rest day per Monday–Sunday week keeps your streak but resets momentum, so 7 of 7 pays the most.',
    ],
  },
  {
    icon: '⚠',
    name: 'Penalties',
    guide: [
      'A missed day costs EXP and breaks your streak.',
      'Clear the next day’s penalty quest with proof and your streak comes back.',
    ],
  },
  {
    icon: '△',
    name: 'Levels and ranks',
    guide: [
      'EXP raises your level. Reaching a rank’s level unlocks its Rank-up Trial; clear it to be promoted from E up to S.',
      'New features open as you level up. This guide explains each one.',
    ],
  },
];

export const isUnlocked = (feature: Feature, level: number) => level >= (UNLOCKS.find((u) => u.feature === feature)?.level ?? 1);

export const unlockFor = (feature: Feature) => UNLOCKS.find((u) => u.feature === feature)!;

/** Unlocks reached at this level that the player hasn't been shown yet. */
export const newUnlocks = (level: number, seen: Feature[]) => UNLOCKS.filter((u) => level >= u.level && !seen.includes(u.feature));
