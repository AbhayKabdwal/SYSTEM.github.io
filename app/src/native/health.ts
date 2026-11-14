import { registerPlugin } from '@capacitor/core';
import type { QuestTask } from '../domain';
import { isNative } from './platform';

export interface HealthSession {
  kind: 'running' | 'walking' | 'biking' | 'strength' | 'hiit' | 'other';
  minutes: number;
  metres: number;
  title: string;
}

interface HealthBridge {
  availability(): Promise<{ status: 'available' | 'update_required' | 'unavailable' }>;
  requestAccess(): Promise<{ granted: boolean }>;
  readDay(opts: { date: string }): Promise<{ steps: number; sessions: HealthSession[] }>;
}

const Health = registerPlugin<HealthBridge>('Health');

export async function healthStatus() {
  if (!isNative) return 'unavailable' as const;
  try {
    return (await Health.availability()).status;
  } catch {
    return 'unavailable' as const;
  }
}

export async function connectHealth(): Promise<boolean> {
  return (await Health.requestAccess()).granted;
}

export const readHealthDay = (date: string) => Health.readDay({ date });

/** Which recorded activity counts toward a quest task, and how much. */
export function healthValueFor(task: QuestTask, day: { steps: number; sessions: HealthSession[] }): number | null {
  const sum = (kinds: HealthSession['kind'][], field: 'minutes' | 'metres') => day.sessions.filter((s) => kinds.includes(s.kind)).reduce((a, s) => a + s[field], 0);
  const id = task.id;
  if (task.unit === 'km' && (id === 'jog' || id === 'run' || /run|jog/i.test(task.label))) return Math.round(sum(['running'], 'metres') / 100) / 10;
  if (task.unit === 'min' && (id === 'brisk_walk' || /walk/i.test(task.label))) {
    // No recorded walk? Roughly 100 steps a minute of brisk walking.
    const mins = sum(['walking'], 'minutes');
    return mins || Math.floor(day.steps / 100);
  }
  if (task.unit === 'min' && (id === 'bike' || /bike|cycl/i.test(task.label))) return sum(['biking'], 'minutes');
  return null;
}
