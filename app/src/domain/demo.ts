import { addDays, toDateStr } from './dates';
import { RANK_GATES } from './levels';
import { buildPool, DEFAULT_PREFS } from './prefs';
import type { DailyLog, DateStr, Logs, Player, Quest } from './types';

// Test hunters for finding edge cases: a believable history that reaches a target
// level through the normal rules (nothing is set directly), so every derived number
// on screen is exactly what a real player with that history would see.

export type DemoPreset = 'max' | 'job' | 'fresh_trial';

export const DEMO_PRESETS: Record<DemoPreset, { label: string; days: number; text: string }> = {
  max: { label: 'Max level (100, S-Rank)', days: 1150, text: 'Every rank cleared, class choice waiting, hundreds of stat points to spend.' },
  job: { label: 'One day before Job Change (level 39)', days: 186, text: 'Near the level-40 class questline.' },
  fresh_trial: { label: 'First rank-up trial ready (level 10)', days: 18, text: 'D-Rank trial available, early unlocks.' },
};

const TASKS: Quest['tasks'] = [
  { id: 'pushup', label: 'Push-ups', target: 50, unit: 'reps', pattern: 'push', hardSet: 15 },
  { id: 'squat', label: 'Bodyweight Squats', target: 80, unit: 'reps', pattern: 'squat', hardSet: 25 },
  { id: 'plank', label: 'Plank Hold', target: 120, unit: 'sec', pattern: 'core', hardSet: 45 },
  { id: 'jog', label: 'Jog', target: 2.5, unit: 'km', pattern: 'cardio', hardSet: 1.5 },
];
const TEMPLATES = ['tpl_chest', 'tpl_back', 'tpl_legs'] as const;
const LIFTS: Record<(typeof TEMPLATES)[number], [string, string]> = {
  tpl_chest: ['e_bpress', 'e_pushup'],
  tpl_back: ['e_brow', 'e_pull'],
  tpl_legs: ['e_squat', 'e_rdl'],
};
const SIDE: Quest['tasks'] = [{ id: 'burpees', label: 'Burpees', target: 30, unit: 'reps' }];
const full = (q: Quest['tasks']) => Object.fromEntries(q.map((t) => [t.id, t.target]));

/** A history ending yesterday; today is left open so the quest page is live. */
export function buildDemo(preset: DemoPreset, today: DateStr): { player: Player; logs: Logs } {
  const { days } = DEMO_PRESETS[preset];
  const start = addDays(today, -days);
  const logs: Logs = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const at = new Date(`${d}T19:00:00`).toISOString();
    const tpl = TEMPLATES[i % 3]!;
    const kg = 40 + Math.floor(i / 10);
    const log: DailyLog = {
      dailyQuest: { name: 'DAILY QUEST', tasks: TASKS, kind: 'daily' },
      questProgress: full(TASKS),
      proof: { photoId: `demo-${d}`, at, visibility: 'private' },
      recovery: { water: 8, creatine: i % 2 === 0 },
      templateId: tpl,
      exLogs: {
        [LIFTS[tpl][0]]: { sets: [{ v: kg, reps: 8 }, { v: kg, reps: 8 }, { v: kg, reps: 7, rpe: 9 }] },
        [LIFTS[tpl][1]]: { sets: [{ v: 12 }, { v: 10 }] },
      },
      savedAt: at,
      trainingSavedAt: at,
      // Rank trials rotate through D..S; the ledger only accepts the one for your next rank,
      // once your level allows it, so promotions happen at the earliest real moment.
      side: {
        trial: { quest: { name: 'RANK-UP TRIAL', tasks: SIDE, kind: 'trial' }, progress: full(SIDE), rank: RANK_GATES[1 + (i % 5)]!.rank },
        job: { quest: { name: 'JOB CHANGE QUEST', tasks: SIDE, kind: 'trial' }, progress: full(SIDE) },
        ...(new Date(`${d}T12:00:00`).getDay() === 1 ? { dungeon: { quest: { name: 'INSTANT DUNGEON: TEST GATE', tasks: SIDE, kind: 'dungeon' }, progress: full(SIDE) } } : {}),
      },
      ...(i % 7 === 3 ? { checkin: { sleep: 7.5, soreness: 2 } } : {}),
    };
    if (preset !== 'max') delete log.side!.job;
    if (preset === 'fresh_trial') delete log.side!.trial;
    logs[d] = log;
  }
  const prefs = { ...DEFAULT_PREFS, equipment: ['pullup_bar' as const], pool: [] as string[] };
  prefs.pool = buildPool(prefs);
  return {
    player: {
      name: preset === 'max' ? 'MAX TEST' : preset === 'job' ? 'JOB TEST' : 'TRIAL TEST',
      createdAt: new Date(`${start}T09:00:00`).toISOString(),
      rulesSince: start,
      waterTarget: 8,
      prefs,
      test: true,
    },
    logs,
  };
}

export const todayForDemo = () => toDateStr(new Date());
