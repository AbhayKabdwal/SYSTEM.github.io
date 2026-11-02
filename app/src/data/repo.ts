import { DEFAULT_QUEST_POOL, DEFAULT_TEMPLATES } from '../domain';
import type { DailyLog, DateStr, Logs, Player, QuestTask, Template } from '../domain';
import { db as defaultDb, type SystemDB } from './db';

export interface AppData {
  player: Player | null;
  templates: Template[];
  questPool: QuestTask[];
  logs: Logs;
}

export type MetaKey = 'player' | 'templates' | 'questPool';

/** Last local change per settings key; sync uses these for last-writer-wins. */
export type MetaStamps = Partial<Record<MetaKey, string>>;

export const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
export const nowIso = () => new Date().toISOString();

export function createRepo(db: SystemDB = defaultDb) {
  return {
    db,

    async load(): Promise<{ data: AppData; stamps: MetaStamps }> {
      const [meta, logRows] = await Promise.all([db.meta.toArray(), db.logs.toArray()]);
      const get = (k: MetaKey) => meta.find((m) => m.key === k);
      const stamps: MetaStamps = {};
      for (const k of ['player', 'templates', 'questPool'] as const) {
        const row = get(k);
        if (row) stamps[k] = row.updatedAt;
      }
      return {
        data: {
          player: (get('player')?.value as Player | undefined) ?? null,
          templates: (get('templates')?.value as Template[] | undefined) ?? DEFAULT_TEMPLATES,
          questPool: (get('questPool')?.value as QuestTask[] | undefined) ?? DEFAULT_QUEST_POOL,
          logs: Object.fromEntries(logRows.map((r) => [r.date, r.log])),
        },
        stamps,
      };
    },

    async putMeta(key: MetaKey, value: unknown, updatedAt = nowIso()) {
      await db.meta.put({ key, value, updatedAt });
      return updatedAt;
    },

    async getSetting<T>(key: string): Promise<T | undefined> {
      return (await db.meta.get(key))?.value as T | undefined;
    },

    async putSetting(key: string, value: unknown) {
      await db.meta.put({ key, value, updatedAt: nowIso() });
    },

    async putLog(date: DateStr, log: DailyLog) {
      await db.logs.put({ date, log });
    },

    async putLogs(logs: Logs) {
      await db.logs.bulkPut(Object.entries(logs).map(([date, log]) => ({ date, log })));
    },

    async deleteLog(date: DateStr) {
      const row = await db.logs.get(date);
      await db.transaction('rw', db.logs, db.photos, async () => {
        await db.logs.delete(date);
        const ids = [...(row?.log.photoIds ?? []), row?.log.proof?.photoId].filter((x): x is string => !!x);
        if (ids.length) await db.photos.bulkDelete(ids);
      });
    },

    async putPhoto(blob: Blob, id = uid()) {
      await db.photos.put({ id, blob, createdAt: nowIso() });
      return id;
    },

    getPhoto: (id: string) => db.photos.get(id),
    deletePhoto: (id: string) => db.photos.delete(id),
    allPhotos: () => db.photos.toArray(),

    /** Removes everything on this device. */
    async wipe() {
      await db.transaction('rw', db.meta, db.logs, db.photos, async () => {
        await Promise.all([db.meta.clear(), db.logs.clear(), db.photos.clear()]);
      });
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
