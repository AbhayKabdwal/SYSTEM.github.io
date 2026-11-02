import { describe, expect, it } from 'vitest';
import { mergeSnapshots, stableStringify, toSnapshot, withLocalPhotos, type Snapshot } from './vault';
import { DEFAULT_QUEST_POOL, DEFAULT_TEMPLATES } from '../domain';

const snap = (over: Partial<Snapshot['data']>, stamps: Snapshot['stamps'] = {}): Snapshot =>
  toSnapshot({ player: { name: 'A' }, templates: DEFAULT_TEMPLATES, questPool: DEFAULT_QUEST_POOL, logs: {}, ...over }, stamps);

describe('snapshots', () => {
  it('keeps photo ids but never inline photo data', () => {
    const s = snap({ logs: { d: { photoIds: ['p1'], photos: ['data:image/jpeg;base64,AA'], savedAt: '1' } } });
    expect(JSON.stringify(s)).toContain('p1');
    expect(JSON.stringify(s)).not.toContain('data:image');
  });

  it('merges settings by newest stamp and logs by newest save', () => {
    const local = snap({ player: { name: 'LOCAL' }, logs: { a: { savedAt: '2' } } }, { player: '2026-11-02' });
    const remote = snap({ player: { name: 'REMOTE' }, questPool: [], logs: { a: { savedAt: '1' }, b: { savedAt: '1' } } }, { player: '2026-11-01', questPool: '2026-11-03' });
    const m = mergeSnapshots(local, remote);
    expect(m.data.player?.name).toBe('LOCAL');
    expect(m.data.questPool).toEqual([]);
    expect(m.stamps.questPool).toBe('2026-11-03');
    expect(Object.keys(m.data.logs).sort()).toEqual(['a', 'b']);
    expect(m.data.logs.a?.savedAt).toBe('2');
  });

  it('is idempotent: merging a remote into itself changes nothing', () => {
    const r = snap({ logs: { a: { savedAt: '1' } } }, { player: '1' });
    expect(stableStringify(mergeSnapshots(r, r))).toBe(stableStringify(r));
  });

  it('puts local photo ids back after a merge', () => {
    const merged = withLocalPhotos({ player: null, templates: [], questPool: [], logs: { a: { savedAt: '2' } } }, { a: { photoIds: ['p1'] } });
    expect(merged.logs.a?.photoIds).toEqual(['p1']);
  });

  it('prefers the synced photo ids when the merged log has them', () => {
    const merged = withLocalPhotos({ player: null, templates: [], questPool: [], logs: { a: { savedAt: '2', photoIds: ['p2'] } } }, { a: { photoIds: ['p1'] } });
    expect(merged.logs.a?.photoIds).toEqual(['p2']);
  });

  it('stableStringify ignores key order and undefined', () => {
    expect(stableStringify({ b: 1, a: [1, { y: 2, x: undefined }] })).toBe(stableStringify({ a: [1, { y: 2 }], b: 1 }));
  });
});
