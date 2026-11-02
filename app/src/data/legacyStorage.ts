import { DEFAULT_QUEST_POOL, DEFAULT_TEMPLATES } from '../domain';
import type { Logs, Player, QuestTask, Template } from '../domain';

// Read-only view of the v1 app's localStorage keys. Phase 1 replaces this with
// IndexedDB plus a one-time migration; nothing here writes.

export interface AppData {
  player: Player | null;
  templates: Template[];
  questPool: QuestTask[];
  logs: Logs;
}

const LOG_PREFIX = 'sl_log:';

function read<T>(storage: Storage, key: string): T | null {
  try {
    const v = storage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

/** Saved items first, then any defaults the user has not overridden (same merge as v1). */
function mergeById<T extends { id: string }>(saved: T[] | null, defaults: T[]): T[] {
  if (!saved) return [...defaults];
  const seen = new Set(saved.map((x) => x.id));
  return [...saved, ...defaults.filter((x) => !seen.has(x.id))];
}

export function loadLegacyData(storage: Storage = window.localStorage): AppData {
  const logs: Logs = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(LOG_PREFIX)) continue;
    const log = read<Logs[string]>(storage, key);
    if (log) logs[key.slice(LOG_PREFIX.length)] = log;
  }
  return {
    player: read<Player>(storage, 'sl_player'),
    templates: mergeById(read<Template[]>(storage, 'sl_templates'), DEFAULT_TEMPLATES),
    questPool: mergeById(read<QuestTask[]>(storage, 'sl_quest_pool'), DEFAULT_QUEST_POOL),
    logs,
  };
}
