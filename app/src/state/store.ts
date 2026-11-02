import { create } from 'zustand';
import { DEFAULT_QUEST_POOL, DEFAULT_TEMPLATES } from '../domain';
import type { DailyLog, DateStr, Logs, Player, QuestTask, Template } from '../domain';
import { createRepo, nowIso, uid, type AppData, type MetaKey, type MetaStamps, type Repo } from '../data/repo';
import { loadLegacyData } from '../data/legacyStorage';
import { mergeLogs, parseBackup, type ParsedBackup } from '../data/backup';
import { dataUrlToBlob } from '../data/blobs';

export interface AppState extends AppData {
  ready: boolean;
  stamps: MetaStamps;
  /** Bumped on every local write; the sync engine watches it. */
  revision: number;
  init(): Promise<void>;
  setPlayer(p: Player): Promise<void>;
  saveLog(date: DateStr, log: DailyLog): Promise<void>;
  deleteLog(date: DateStr): Promise<void>;
  setTemplates(t: Template[]): Promise<void>;
  setQuestPool(q: QuestTask[]): Promise<void>;
  importBackup(json: unknown): Promise<{ logs: number; photos: number }>;
  /** Apply a merged snapshot from sync without bumping `revision`. */
  applyRemote(data: AppData, stamps: MetaStamps): Promise<void>;
  wipe(): Promise<void>;
}

const LEGACY_MIGRATED = 'migratedFromV1';

export function createAppStore(repo: Repo = createRepo(), legacy: () => ReturnType<typeof loadLegacyData> | null = safeLegacy) {
  return create<AppState>((set, get) => {
    const writeMeta = async (key: MetaKey, value: unknown) => {
      const at = await repo.putMeta(key, value);
      set((s) => ({ stamps: { ...s.stamps, [key]: at }, revision: s.revision + 1 }));
    };

    const storePhotos = async (photos: ParsedBackup['photos']) => {
      let n = 0;
      for (const [id, url] of Object.entries(photos)) {
        const blob = await dataUrlToBlob(url).catch(() => null);
        if (blob) {
          await repo.putPhoto(blob, id);
          n++;
        }
      }
      return n;
    };

    return {
      ready: false,
      player: null,
      templates: DEFAULT_TEMPLATES,
      questPool: DEFAULT_QUEST_POOL,
      logs: {},
      stamps: {},
      revision: 0,

      async init() {
        // One-time copy of v1 localStorage data (same origin on GitHub Pages). v1 data is left in place.
        if (!(await repo.getSetting<boolean>(LEGACY_MIGRATED))) {
          const old = legacy();
          const { data } = await repo.load();
          if (old?.player && !data.player) {
            const parsed = parseBackup({ version: 1, ...old }, uid);
            await repo.putMeta('player', parsed.player);
            await repo.putMeta('templates', parsed.templates ?? DEFAULT_TEMPLATES);
            await repo.putMeta('questPool', parsed.questPool ?? DEFAULT_QUEST_POOL);
            await repo.putLogs(parsed.logs);
            await storePhotos(parsed.photos);
          }
          await repo.putSetting(LEGACY_MIGRATED, true);
        }
        const { data, stamps } = await repo.load();
        set({ ...data, stamps, ready: true });
      },

      async setPlayer(p) {
        set({ player: p });
        await writeMeta('player', p);
      },

      async saveLog(date, log) {
        set((s) => ({ logs: { ...s.logs, [date]: log } }));
        await repo.putLog(date, log);
        set((s) => ({ revision: s.revision + 1 }));
      },

      async deleteLog(date) {
        set((s) => {
          const logs = { ...s.logs };
          delete logs[date];
          return { logs };
        });
        await repo.deleteLog(date);
        set((s) => ({ revision: s.revision + 1 }));
      },

      async setTemplates(t) {
        set({ templates: t });
        await writeMeta('templates', t);
      },

      async setQuestPool(q) {
        set({ questPool: q });
        await writeMeta('questPool', q);
      },

      async importBackup(json) {
        const parsed = parseBackup(json, uid);
        const s = get();
        // Imported logs win only where they are newer; nothing local is deleted.
        const logs = mergeLogs(s.logs, parsed.logs);
        const changed: Logs = Object.fromEntries(Object.entries(logs).filter(([d, l]) => s.logs[d] !== l));
        await repo.putLogs(changed);
        const photos = await storePhotos(parsed.photos);
        set({ logs });
        if (parsed.player && !s.player) await get().setPlayer(parsed.player);
        if (parsed.templates?.length) {
          const seen = new Set(parsed.templates.map((t) => t.id));
          await get().setTemplates([...parsed.templates, ...s.templates.filter((t) => !seen.has(t.id))]);
        }
        if (parsed.questPool?.length) {
          const seen = new Set(parsed.questPool.map((q) => q.id));
          await get().setQuestPool([...parsed.questPool, ...s.questPool.filter((q) => !seen.has(q.id))]);
        }
        set((st) => ({ revision: st.revision + 1 }));
        return { logs: Object.keys(changed).length, photos };
      },

      async applyRemote(data, stamps) {
        const s = get();
        const changed = Object.fromEntries(Object.entries(data.logs).filter(([d, l]) => s.logs[d] !== l));
        if (Object.keys(changed).length) await repo.putLogs(changed);
        for (const k of ['player', 'templates', 'questPool'] as const) {
          if (stamps[k] && stamps[k] !== s.stamps[k]) await repo.putMeta(k, data[k], stamps[k]);
        }
        set({ ...data, stamps: { ...s.stamps, ...stamps } });
      },

      async wipe() {
        await repo.wipe();
        await repo.putSetting(LEGACY_MIGRATED, true);
        set({ player: null, templates: DEFAULT_TEMPLATES, questPool: DEFAULT_QUEST_POOL, logs: {}, stamps: {}, revision: get().revision + 1 });
      },
    };
  });
}

function safeLegacy() {
  try {
    return loadLegacyData();
  } catch {
    return null;
  }
}

export const useApp = createAppStore();

export { nowIso };
