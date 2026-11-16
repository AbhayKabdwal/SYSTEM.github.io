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
  /**
   * Swaps in a test hunter. The real hunter is saved first (once, so trying several
   * test hunters still keeps the original) and comes back with restoreReal().
   */
  replaceAll(player: Player, logs: Logs): Promise<void>;
  restoreReal(): Promise<boolean>;
}

const LEGACY_MIGRATED = 'migratedFromV1';
/** Your real hunter, kept while a test hunter is loaded. */
export const REAL_SNAPSHOT = 'realHunterSnapshot';

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

      async replaceAll(player, logs) {
        const s = get();
        if (!(await repo.getSetting(REAL_SNAPSHOT)) && s.player && !s.player.test) {
          await repo.putSetting(REAL_SNAPSHOT, { player: s.player, templates: s.templates, questPool: s.questPool, logs: s.logs, stamps: s.stamps });
        }
        await repo.clearData();
        await repo.putLogs(logs);
        await repo.putMeta('templates', DEFAULT_TEMPLATES);
        await repo.putMeta('questPool', DEFAULT_QUEST_POOL);
        set({ logs, templates: DEFAULT_TEMPLATES, questPool: DEFAULT_QUEST_POOL });
        await get().setPlayer(player);
      },

      async restoreReal() {
        const snap = await repo.getSetting<AppData & { stamps: MetaStamps }>(REAL_SNAPSHOT);
        await repo.clearData();
        if (snap) {
          await repo.putLogs(snap.logs);
          for (const k of ['player', 'templates', 'questPool'] as const) if (snap[k]) await repo.putMeta(k, snap[k], snap.stamps[k]);
          await repo.putSetting(REAL_SNAPSHOT, null);
          set({ player: snap.player, templates: snap.templates, questPool: snap.questPool, logs: snap.logs, stamps: snap.stamps, revision: get().revision + 1 });
          return true;
        }
        set({ player: null, templates: DEFAULT_TEMPLATES, questPool: DEFAULT_QUEST_POOL, logs: {}, stamps: {}, revision: get().revision + 1 });
        return false;
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
