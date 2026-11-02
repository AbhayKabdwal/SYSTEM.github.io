import { beforeEach, describe, expect, it } from 'vitest';
import { createAppStore } from './store';
import { createRepo } from '../data/repo';
import { SystemDB } from '../data/db';
import type { AppData } from '../data/repo';

let dbn = 0;
const fresh = (legacy: AppData | null = null) => {
  const repo = createRepo(new SystemDB(`test-${++dbn}`));
  return { repo, store: createAppStore(repo, () => legacy) };
};

describe('app store', () => {
  beforeEach(() => undefined);

  it('starts empty on a new device', async () => {
    const { store } = fresh();
    await store.getState().init();
    expect(store.getState().ready).toBe(true);
    expect(store.getState().player).toBeNull();
  });

  it('migrates v1 localStorage data once', async () => {
    const legacy: AppData = {
      player: { name: 'JINWOO' },
      templates: [],
      questPool: [],
      logs: { '2026-11-01': { questProgress: { pushups: 100 }, savedAt: '1' } },
    };
    const { repo, store } = fresh(legacy);
    await store.getState().init();
    expect(store.getState().player?.name).toBe('JINWOO');
    expect(store.getState().logs['2026-11-01']?.savedAt).toBe('1');

    // Second launch reads IndexedDB, not v1 again.
    const again = createAppStore(repo, () => ({ ...legacy, player: { name: 'OTHER' } }));
    await again.getState().init();
    expect(again.getState().player?.name).toBe('JINWOO');
  });

  it('persists saves and bumps the revision', async () => {
    const { repo, store } = fresh();
    await store.getState().init();
    await store.getState().setPlayer({ name: 'A' });
    const r = store.getState().revision;
    await store.getState().saveLog('2026-11-02', { savedAt: 'x' });
    expect(store.getState().revision).toBe(r + 1);
    const reloaded = createAppStore(repo, () => null);
    await reloaded.getState().init();
    expect(reloaded.getState().logs['2026-11-02']?.savedAt).toBe('x');
  });

  it('imports by merging, never deleting', async () => {
    const { store } = fresh();
    await store.getState().init();
    await store.getState().saveLog('2026-11-01', { savedAt: '2026-11-01T10:00Z' });
    const res = await store.getState().importBackup({
      version: 2,
      logs: { '2026-11-01': { savedAt: '2026-11-01T09:00Z' }, '2026-10-31': { savedAt: '2026-10-31T09:00Z' } },
      questPool: [{ id: 'q', label: 'Q', target: 1, unit: 'reps' }],
    });
    expect(res.logs).toBe(1);
    expect(store.getState().logs['2026-11-01']?.savedAt).toBe('2026-11-01T10:00Z');
    expect(store.getState().questPool[0]?.id).toBe('q');
    expect(store.getState().questPool.length).toBeGreaterThan(1);
  });

  it('deleting a log removes its photos', async () => {
    const { repo, store } = fresh();
    await store.getState().init();
    const id = await repo.putPhoto(new Blob(['x']));
    await store.getState().saveLog('2026-11-01', { photoIds: [id, null, null] });
    await store.getState().deleteLog('2026-11-01');
    expect(await repo.getPhoto(id)).toBeUndefined();
  });

  it('wipe clears everything and does not re-run the v1 migration', async () => {
    const { repo, store } = fresh({ player: { name: 'OLD' }, templates: [], questPool: [], logs: {} });
    await store.getState().init();
    await store.getState().wipe();
    const after = createAppStore(repo, () => ({ player: { name: 'OLD' }, templates: [], questPool: [], logs: {} }));
    await after.getState().init();
    expect(after.getState().player).toBeNull();
  });
});
