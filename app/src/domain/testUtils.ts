import type { DailyLog, Logs, Quest } from './types';

export const QUEST: Quest = {
  name: 'TEST',
  tasks: [
    { id: 'pushups', label: 'Push-ups', target: 100, unit: 'reps' },
    { id: 'squats', label: 'Squats', target: 100, unit: 'reps' },
  ],
};

export const cleared = (): DailyLog => ({ dailyQuest: QUEST, questProgress: { pushups: 100, squats: 120 } });
export const missed = (): DailyLog => ({ dailyQuest: QUEST, questProgress: { pushups: 40 } });

/** `logsFrom({ '2026-11-01': 'x', '2026-11-02': '-' })`: x = cleared, - = missed. */
export function logsFrom(spec: Record<string, 'x' | '-'>): Logs {
  return Object.fromEntries(Object.entries(spec).map(([d, s]) => [d, s === 'x' ? cleared() : missed()]));
}
