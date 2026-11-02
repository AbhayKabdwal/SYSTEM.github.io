import type { Equipment, Goal, Limitation, MuscleWeights, Pattern, QuestUnit } from './types';

/** 0 = E-rank … 5 = S-rank. */
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;
export const TIERS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;

export interface LibraryExercise {
  id: string;
  name: string;
  pattern: Pattern;
  unit: QuestUnit;
  /** Lowest and highest tier this variation is used at. */
  tiers: [Tier, Tier];
  /** Daily quest volume per tier, indexed by tier. Only entries inside `tiers` are used. */
  targets: number[];
  /** Units in one hard set (near failure) for an average trainee at this variation's tiers. */
  hardSet: number;
  /** Needs any one of these. Omitted = no equipment. */
  equip?: Equipment[];
  /** Left out for people with these limitations. */
  avoid?: Limitation[];
  goals: Goal[];
  muscles: MuscleWeights;
}

const _ = 0;

// Progressions follow common calisthenics ladders: each rank moves to a harder variation,
// so volume stays sane while difficulty climbs. Targets are a full day's quest volume.
export const LIBRARY: LibraryExercise[] = [
  // ── Push ──
  { id: 'incline_pushup', name: 'Incline Push-ups', pattern: 'push', unit: 'reps', tiers: [0, 0], targets: [40], hardSet: 20, goals: ['strength', 'muscle', 'fat_loss'], muscles: { chest: 1, front_delts: 0.5, triceps: 0.6 } },
  { id: 'pushup', name: 'Push-ups', pattern: 'push', unit: 'reps', tiers: [0, 2], targets: [25, 50, 80], hardSet: 15, goals: ['strength', 'muscle', 'fat_loss', 'skills'], muscles: { chest: 1, front_delts: 0.6, triceps: 0.6, abs: 0.2 } },
  { id: 'diamond_pushup', name: 'Diamond Push-ups', pattern: 'push', unit: 'reps', tiers: [2, 3], targets: [_, _, 40, 60], hardSet: 12, avoid: ['wrists'], goals: ['strength', 'muscle'], muscles: { triceps: 1, chest: 0.7, front_delts: 0.5 } },
  { id: 'decline_pushup', name: 'Decline Push-ups', pattern: 'push', unit: 'reps', tiers: [2, 3], targets: [_, _, 40, 60], hardSet: 12, goals: ['strength', 'muscle'], muscles: { chest: 0.9, front_delts: 0.8, triceps: 0.6 } },
  { id: 'archer_pushup', name: 'Archer Push-ups', pattern: 'push', unit: 'reps', tiers: [3, 4], targets: [_, _, _, 30, 45], hardSet: 8, avoid: ['shoulders'], goals: ['strength', 'skills'], muscles: { chest: 1, triceps: 0.6, front_delts: 0.6 } },
  { id: 'pseudo_planche_pushup', name: 'Pseudo-planche Push-ups', pattern: 'push', unit: 'reps', tiers: [4, 5], targets: [_, _, _, _, 40, 60], hardSet: 8, avoid: ['wrists'], goals: ['strength', 'skills'], muscles: { front_delts: 1, chest: 0.7, triceps: 0.6, abs: 0.4 } },
  { id: 'one_arm_pushup', name: 'One-arm Push-ups', pattern: 'push', unit: 'reps', tiers: [5, 5], targets: [_, _, _, _, _, 20], hardSet: 5, avoid: ['shoulders'], goals: ['strength', 'skills'], muscles: { chest: 1, triceps: 0.7, front_delts: 0.6, obliques: 0.5 } },
  { id: 'pike_pushup', name: 'Pike Push-ups', pattern: 'push', unit: 'reps', tiers: [1, 3], targets: [_, 25, 40, 50], hardSet: 10, avoid: ['shoulders'], goals: ['strength', 'skills'], muscles: { front_delts: 1, side_delts: 0.5, triceps: 0.7, traps: 0.3 } },
  { id: 'bench_dips', name: 'Bench Dips', pattern: 'push', unit: 'reps', tiers: [0, 1], targets: [20, 40], hardSet: 15, avoid: ['shoulders'], goals: ['muscle', 'fat_loss'], muscles: { triceps: 1, front_delts: 0.4, chest: 0.3 } },
  { id: 'dips', name: 'Dips', pattern: 'push', unit: 'reps', tiers: [2, 5], targets: [_, _, 30, 45, 60, 80], hardSet: 10, equip: ['pullup_bar', 'gym'], avoid: ['shoulders'], goals: ['strength', 'muscle', 'skills'], muscles: { chest: 0.7, triceps: 1, front_delts: 0.5 } },
  { id: 'db_floor_press', name: 'Dumbbell Floor Press', pattern: 'push', unit: 'reps', tiers: [0, 5], targets: [30, 40, 50, 60, 70, 80], hardSet: 12, equip: ['dumbbells', 'gym'], goals: ['strength', 'muscle'], muscles: { chest: 1, triceps: 0.6, front_delts: 0.5 } },
  { id: 'db_shoulder_press', name: 'Dumbbell Shoulder Press', pattern: 'push', unit: 'reps', tiers: [1, 5], targets: [_, 30, 40, 50, 60, 70], hardSet: 10, equip: ['dumbbells', 'gym'], avoid: ['shoulders'], goals: ['strength', 'muscle'], muscles: { front_delts: 1, side_delts: 0.6, triceps: 0.6 } },

  // ── Pull ──
  { id: 'doorframe_row', name: 'Doorframe Rows', pattern: 'pull', unit: 'reps', tiers: [0, 1], targets: [30, 50], hardSet: 15, goals: ['strength', 'muscle', 'fat_loss'], muscles: { lats: 0.8, rear_delts: 0.6, biceps: 0.6, traps: 0.4 } },
  { id: 'superman', name: 'Superman Hold', pattern: 'pull', unit: 'sec', tiers: [0, 2], targets: [60, 90, 120], hardSet: 30, goals: ['strength', 'endurance'], muscles: { lower_back: 1, glutes: 0.5, traps: 0.4, rear_delts: 0.3 } },
  { id: 'dead_hang', name: 'Dead Hang', pattern: 'pull', unit: 'sec', tiers: [0, 1], targets: [60, 90], hardSet: 30, equip: ['pullup_bar', 'gym'], goals: ['strength', 'skills'], muscles: { forearms: 1, lats: 0.4 } },
  { id: 'negative_pullup', name: 'Negative Pull-ups', pattern: 'pull', unit: 'reps', tiers: [0, 1], targets: [10, 20], hardSet: 5, equip: ['pullup_bar', 'gym'], goals: ['strength', 'muscle', 'skills'], muscles: { lats: 1, biceps: 0.7, forearms: 0.4 } },
  { id: 'pullup', name: 'Pull-ups', pattern: 'pull', unit: 'reps', tiers: [1, 3], targets: [_, 15, 30, 45], hardSet: 6, equip: ['pullup_bar', 'gym'], goals: ['strength', 'muscle', 'skills'], muscles: { lats: 1, biceps: 0.6, rear_delts: 0.3, forearms: 0.3 } },
  { id: 'chinup', name: 'Chin-ups', pattern: 'pull', unit: 'reps', tiers: [1, 3], targets: [_, 15, 30, 45], hardSet: 7, equip: ['pullup_bar', 'gym'], goals: ['muscle', 'strength'], muscles: { lats: 0.9, biceps: 0.9, forearms: 0.3 } },
  { id: 'inverted_row', name: 'Inverted Rows', pattern: 'pull', unit: 'reps', tiers: [1, 3], targets: [_, 30, 45, 60], hardSet: 12, equip: ['pullup_bar', 'gym'], goals: ['strength', 'muscle', 'fat_loss'], muscles: { lats: 0.8, rear_delts: 0.7, traps: 0.6, biceps: 0.5 } },
  { id: 'ctb_pullup', name: 'Chest-to-Bar Pull-ups', pattern: 'pull', unit: 'reps', tiers: [3, 4], targets: [_, _, _, 25, 35], hardSet: 5, equip: ['pullup_bar', 'gym'], goals: ['strength', 'skills'], muscles: { lats: 1, biceps: 0.6, traps: 0.5, rear_delts: 0.4 } },
  { id: 'archer_pullup', name: 'Archer Pull-ups', pattern: 'pull', unit: 'reps', tiers: [4, 5], targets: [_, _, _, _, 20, 30], hardSet: 4, equip: ['pullup_bar', 'gym'], avoid: ['shoulders'], goals: ['strength', 'skills'], muscles: { lats: 1, biceps: 0.8, forearms: 0.4 } },
  { id: 'muscle_up', name: 'Muscle-ups', pattern: 'pull', unit: 'reps', tiers: [5, 5], targets: [_, _, _, _, _, 15], hardSet: 3, equip: ['pullup_bar', 'gym'], avoid: ['shoulders', 'wrists'], goals: ['skills', 'strength'], muscles: { lats: 1, chest: 0.5, triceps: 0.7, biceps: 0.6 } },
  { id: 'db_row', name: 'Dumbbell Rows', pattern: 'pull', unit: 'reps', tiers: [0, 5], targets: [30, 40, 50, 60, 70, 80], hardSet: 12, equip: ['dumbbells', 'gym'], goals: ['strength', 'muscle'], muscles: { lats: 0.9, traps: 0.6, rear_delts: 0.5, biceps: 0.5 } },
  { id: 'db_curl', name: 'Dumbbell Curls', pattern: 'pull', unit: 'reps', tiers: [0, 5], targets: [30, 40, 50, 60, 70, 80], hardSet: 12, equip: ['dumbbells', 'gym'], goals: ['muscle'], muscles: { biceps: 1, forearms: 0.4 } },

  // ── Squat ──
  { id: 'chair_squat', name: 'Chair Squats', pattern: 'squat', unit: 'reps', tiers: [0, 0], targets: [40], hardSet: 20, goals: ['strength', 'muscle', 'fat_loss', 'endurance'], muscles: { quads: 1, glutes: 0.7 } },
  { id: 'squat', name: 'Bodyweight Squats', pattern: 'squat', unit: 'reps', tiers: [0, 2], targets: [50, 80, 120], hardSet: 25, goals: ['strength', 'muscle', 'fat_loss', 'endurance'], muscles: { quads: 1, glutes: 0.8, hamstrings: 0.3, lower_back: 0.2 } },
  { id: 'wall_sit', name: 'Wall Sit', pattern: 'squat', unit: 'sec', tiers: [0, 5], targets: [60, 90, 120, 150, 180, 240], hardSet: 45, goals: ['endurance', 'strength'], muscles: { quads: 1, glutes: 0.3 } },
  { id: 'reverse_lunge', name: 'Reverse Lunges', pattern: 'squat', unit: 'reps', tiers: [1, 3], targets: [_, 40, 60, 80], hardSet: 16, goals: ['strength', 'muscle', 'fat_loss'], muscles: { quads: 0.9, glutes: 0.9, hamstrings: 0.3 } },
  { id: 'jump_squat', name: 'Jump Squats', pattern: 'squat', unit: 'reps', tiers: [2, 4], targets: [_, _, 40, 60, 80], hardSet: 15, avoid: ['knees'], goals: ['fat_loss', 'endurance'], muscles: { quads: 1, glutes: 0.7, calves: 0.6 } },
  { id: 'bulgarian_split_squat', name: 'Bulgarian Split Squats', pattern: 'squat', unit: 'reps', tiers: [2, 4], targets: [_, _, 30, 45, 60], hardSet: 10, goals: ['strength', 'muscle'], muscles: { quads: 1, glutes: 0.9, hamstrings: 0.3 } },
  { id: 'shrimp_squat', name: 'Shrimp Squats', pattern: 'squat', unit: 'reps', tiers: [4, 5], targets: [_, _, _, _, 20, 30], hardSet: 6, avoid: ['knees'], goals: ['strength', 'skills'], muscles: { quads: 1, glutes: 0.8 } },
  { id: 'pistol_squat', name: 'Pistol Squats', pattern: 'squat', unit: 'reps', tiers: [5, 5], targets: [_, _, _, _, _, 30], hardSet: 5, avoid: ['knees'], goals: ['strength', 'skills'], muscles: { quads: 1, glutes: 0.7, calves: 0.3, abs: 0.3 } },
  { id: 'goblet_squat', name: 'Goblet Squats', pattern: 'squat', unit: 'reps', tiers: [0, 5], targets: [30, 40, 50, 60, 70, 80], hardSet: 12, equip: ['dumbbells', 'gym'], goals: ['strength', 'muscle'], muscles: { quads: 1, glutes: 0.8, abs: 0.3 } },
  { id: 'calf_raise', name: 'Calf Raises', pattern: 'squat', unit: 'reps', tiers: [0, 5], targets: [40, 60, 80, 100, 120, 150], hardSet: 25, goals: ['muscle', 'endurance'], muscles: { calves: 1 } },

  // ── Hinge ──
  { id: 'glute_bridge', name: 'Glute Bridges', pattern: 'hinge', unit: 'reps', tiers: [0, 1], targets: [40, 60], hardSet: 20, goals: ['strength', 'muscle', 'fat_loss'], muscles: { glutes: 1, hamstrings: 0.5 } },
  { id: 'sl_glute_bridge', name: 'Single-leg Glute Bridges', pattern: 'hinge', unit: 'reps', tiers: [1, 3], targets: [_, 30, 40, 60], hardSet: 12, goals: ['strength', 'muscle'], muscles: { glutes: 1, hamstrings: 0.6 } },
  { id: 'sl_rdl', name: 'Single-leg Romanian Deadlifts', pattern: 'hinge', unit: 'reps', tiers: [2, 3], targets: [_, _, 30, 40], hardSet: 12, goals: ['strength', 'muscle'], muscles: { hamstrings: 1, glutes: 0.8, lower_back: 0.3 } },
  { id: 'hamstring_walkout', name: 'Hamstring Walkouts', pattern: 'hinge', unit: 'reps', tiers: [3, 4], targets: [_, _, _, 20, 30], hardSet: 8, goals: ['strength'], muscles: { hamstrings: 1, glutes: 0.6 } },
  { id: 'nordic_negative', name: 'Nordic Curl Negatives', pattern: 'hinge', unit: 'reps', tiers: [4, 5], targets: [_, _, _, _, 12, 20], hardSet: 4, avoid: ['knees'], goals: ['strength', 'skills'], muscles: { hamstrings: 1, glutes: 0.3 } },
  { id: 'db_rdl', name: 'Dumbbell Romanian Deadlifts', pattern: 'hinge', unit: 'reps', tiers: [0, 5], targets: [30, 40, 50, 60, 70, 80], hardSet: 12, equip: ['dumbbells', 'gym'], avoid: ['lower_back'], goals: ['strength', 'muscle'], muscles: { hamstrings: 1, glutes: 0.8, lower_back: 0.6 } },

  // ── Core ──
  { id: 'plank', name: 'Plank Hold', pattern: 'core', unit: 'sec', tiers: [0, 2], targets: [60, 120, 180], hardSet: 45, goals: ['strength', 'endurance', 'fat_loss', 'skills'], muscles: { abs: 0.9, obliques: 0.5, front_delts: 0.3 } },
  { id: 'dead_bug', name: 'Dead Bugs', pattern: 'core', unit: 'reps', tiers: [0, 1], targets: [30, 40], hardSet: 20, goals: ['strength', 'endurance'], muscles: { abs: 1, obliques: 0.4 } },
  { id: 'situp', name: 'Sit-ups', pattern: 'core', unit: 'reps', tiers: [0, 2], targets: [30, 60, 100], hardSet: 25, avoid: ['lower_back'], goals: ['endurance', 'fat_loss'], muscles: { abs: 1, obliques: 0.5 } },
  { id: 'side_plank', name: 'Side Plank (total)', pattern: 'core', unit: 'sec', tiers: [0, 3], targets: [60, 90, 120, 150], hardSet: 40, goals: ['strength', 'endurance'], muscles: { obliques: 1, abs: 0.4, side_delts: 0.3 } },
  { id: 'hollow_hold', name: 'Hollow Body Hold', pattern: 'core', unit: 'sec', tiers: [1, 3], targets: [_, 60, 90, 120], hardSet: 30, goals: ['skills', 'strength'], muscles: { abs: 1, obliques: 0.4 } },
  { id: 'leg_raise', name: 'Lying Leg Raises', pattern: 'core', unit: 'reps', tiers: [1, 3], targets: [_, 30, 45, 60], hardSet: 15, goals: ['strength', 'skills'], muscles: { abs: 1, obliques: 0.3 } },
  { id: 'hanging_knee_raise', name: 'Hanging Knee Raises', pattern: 'core', unit: 'reps', tiers: [2, 3], targets: [_, _, 30, 45], hardSet: 12, equip: ['pullup_bar', 'gym'], goals: ['strength', 'skills'], muscles: { abs: 1, forearms: 0.4, obliques: 0.3 } },
  { id: 'v_up', name: 'V-ups', pattern: 'core', unit: 'reps', tiers: [3, 4], targets: [_, _, _, 40, 60], hardSet: 15, avoid: ['lower_back'], goals: ['skills', 'endurance'], muscles: { abs: 1, obliques: 0.4 } },
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raises', pattern: 'core', unit: 'reps', tiers: [3, 5], targets: [_, _, _, 30, 45, 60], hardSet: 10, equip: ['pullup_bar', 'gym'], goals: ['strength', 'skills'], muscles: { abs: 1, forearms: 0.5, obliques: 0.4 } },
  { id: 'dragon_flag_negative', name: 'Dragon Flag Negatives', pattern: 'core', unit: 'reps', tiers: [4, 5], targets: [_, _, _, _, 12, 20], hardSet: 5, avoid: ['lower_back'], goals: ['strength', 'skills'], muscles: { abs: 1, obliques: 0.5, lats: 0.3 } },

  // ── Cardio ──
  { id: 'brisk_walk', name: 'Brisk Walk', pattern: 'cardio', unit: 'min', tiers: [0, 1], targets: [20, 30], hardSet: 40, goals: ['endurance', 'fat_loss'], muscles: { calves: 0.4, quads: 0.3, glutes: 0.3 } },
  { id: 'jog', name: 'Jog', pattern: 'cardio', unit: 'km', tiers: [0, 2], targets: [1.5, 2.5, 3], hardSet: 1.5, avoid: ['knees'], goals: ['endurance', 'fat_loss'], muscles: { quads: 0.6, hamstrings: 0.5, calves: 0.8, glutes: 0.5 } },
  { id: 'run', name: 'Run', pattern: 'cardio', unit: 'km', tiers: [2, 5], targets: [_, _, 4, 5, 7, 10], hardSet: 1.5, avoid: ['knees'], goals: ['endurance', 'fat_loss'], muscles: { quads: 0.6, hamstrings: 0.6, calves: 0.8, glutes: 0.5 } },
  { id: 'jump_rope', name: 'Jump Rope', pattern: 'cardio', unit: 'min', tiers: [0, 5], targets: [5, 8, 10, 15, 20, 25], hardSet: 5, equip: ['jump_rope'], avoid: ['knees'], goals: ['endurance', 'fat_loss'], muscles: { calves: 1, quads: 0.3, forearms: 0.2 } },
  { id: 'bike', name: 'Stationary Bike', pattern: 'cardio', unit: 'min', tiers: [0, 5], targets: [15, 20, 30, 40, 45, 60], hardSet: 12, equip: ['gym'], goals: ['endurance', 'fat_loss'], muscles: { quads: 0.9, glutes: 0.4, calves: 0.4, hamstrings: 0.3 } },
  { id: 'shadow_boxing', name: 'Shadow Boxing', pattern: 'cardio', unit: 'min', tiers: [0, 5], targets: [5, 8, 10, 12, 15, 20], hardSet: 4, goals: ['endurance', 'fat_loss'], muscles: { front_delts: 0.6, side_delts: 0.4, obliques: 0.5, calves: 0.4 } },

  // ── Conditioning ──
  { id: 'jumping_jacks', name: 'Jumping Jacks', pattern: 'conditioning', unit: 'reps', tiers: [0, 2], targets: [50, 100, 150], hardSet: 60, avoid: ['knees'], goals: ['fat_loss', 'endurance'], muscles: { calves: 0.8, quads: 0.3, side_delts: 0.2 } },
  { id: 'high_knees', name: 'High Knees', pattern: 'conditioning', unit: 'sec', tiers: [0, 2], targets: [60, 90, 120], hardSet: 45, avoid: ['knees'], goals: ['fat_loss', 'endurance'], muscles: { quads: 0.5, calves: 0.6, abs: 0.4 } },
  { id: 'squat_thrust', name: 'Squat Thrusts', pattern: 'conditioning', unit: 'reps', tiers: [0, 1], targets: [20, 30], hardSet: 15, avoid: ['wrists'], goals: ['fat_loss', 'endurance'], muscles: { quads: 0.6, abs: 0.5, front_delts: 0.4, chest: 0.3 } },
  { id: 'mountain_climbers', name: 'Mountain Climbers', pattern: 'conditioning', unit: 'reps', tiers: [0, 3], targets: [40, 80, 120, 160], hardSet: 40, avoid: ['wrists'], goals: ['fat_loss', 'endurance'], muscles: { abs: 0.8, front_delts: 0.4, quads: 0.4, obliques: 0.4 } },
  { id: 'burpees', name: 'Burpees', pattern: 'conditioning', unit: 'reps', tiers: [1, 5], targets: [_, 20, 35, 50, 70, 100], hardSet: 12, avoid: ['knees', 'wrists'], goals: ['fat_loss', 'endurance'], muscles: { chest: 0.5, quads: 0.6, front_delts: 0.4, abs: 0.4, calves: 0.3 } },
  { id: 'bear_crawl', name: 'Bear Crawl', pattern: 'conditioning', unit: 'sec', tiers: [1, 3], targets: [_, 60, 90, 120], hardSet: 30, avoid: ['wrists'], goals: ['endurance', 'skills'], muscles: { front_delts: 0.7, abs: 0.6, quads: 0.5, triceps: 0.3 } },
  { id: 'tuck_jumps', name: 'Tuck Jumps', pattern: 'conditioning', unit: 'reps', tiers: [3, 5], targets: [_, _, _, 30, 45, 60], hardSet: 10, avoid: ['knees'], goals: ['fat_loss', 'endurance'], muscles: { quads: 0.8, calves: 0.7, abs: 0.5, glutes: 0.5 } },

  // ── Mobility (recovery protocol only) ──
  { id: 'mobility_flow', name: 'Mobility Flow', pattern: 'mobility', unit: 'min', tiers: [0, 5], targets: [10, 12, 15, 15, 20, 20], hardSet: 60, goals: [], muscles: {} },
];

const byId = new Map(LIBRARY.map((e) => [e.id, e]));
export const libraryExercise = (id: string) => byId.get(id);

export const PATTERN_LABEL: Record<Pattern, string> = {
  push: 'Push',
  pull: 'Pull',
  squat: 'Legs',
  hinge: 'Posterior chain',
  core: 'Core',
  cardio: 'Cardio',
  conditioning: 'Conditioning',
  mobility: 'Mobility',
};

export const QUEST_PATTERNS: Pattern[] = ['push', 'pull', 'squat', 'hinge', 'core', 'cardio', 'conditioning'];
