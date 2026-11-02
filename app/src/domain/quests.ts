import { DEFAULT_QUEST_POOL, PENALTY_QUEST, RECOVERY_QUEST } from './defaults';
import { getFatigue, DELOAD_THRESHOLD } from './fatigue';
import type { DateStr, Logs, Quest, QuestTask } from './types';

const TASKS_PER_QUEST = 3;
const MIN_POOL_SIZE = 3;

// FNV-1a: v1 summed char codes, so dates with the same digits (e.g. 11-02 / 11-20)
// got the same quest and the whole year shared only ~40 distinct seeds.
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic: the same date and pool always give the same tasks. */
export function randomGate(date: DateStr, pool: QuestTask[]): Quest {
  const source = pool.length >= MIN_POOL_SIZE ? pool : DEFAULT_QUEST_POOL;
  const rand = mulberry32(hashString(date));
  const shuffled = [...source];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return { name: 'DAILY QUEST: RANDOM GATE', tasks: shuffled.slice(0, TASKS_PER_QUEST) };
}

export interface QuestContext {
  today: DateStr;
  penalty?: boolean;
  pool?: QuestTask[];
  logs?: Logs;
}

export function questForDate(date: DateStr, ctx: QuestContext): Quest {
  const { today, penalty = false, pool = DEFAULT_QUEST_POOL, logs = {} } = ctx;
  const deload = getFatigue(logs) >= DELOAD_THRESHOLD;
  if (penalty) return deload ? RECOVERY_QUEST : PENALTY_QUEST;
  if (date === today && deload) return RECOVERY_QUEST;
  return randomGate(date, pool);
}
