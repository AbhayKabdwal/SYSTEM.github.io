import { describe, expect, it } from 'vitest';
import { planMedia, referencedPhotos } from './media';
import { openBytes, sealBytes } from '../data/crypto';

describe('media sync', () => {
  it('collects progress and proof photo ids', () => {
    const ids = referencedPhotos({
      a: { photoIds: ['p1', null, 'p2'] },
      b: { proof: { photoId: 'p3', at: '2026-11-02T10:00:00Z', visibility: 'private' } },
    });
    expect([...ids].sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('uploads local-only, downloads remote-only, deletes only old unreferenced files', () => {
    const now = Date.parse('2026-11-02T12:00:00Z');
    const plan = planMedia(
      new Set(['up', 'down', 'both']),
      new Set(['up', 'both', 'orphan-local']),
      new Map([
        ['down', 0],
        ['both', 0],
        ['old-orphan', now - 60 * 60 * 1000],
        ['new-orphan', now - 60 * 1000],
      ]),
      now,
    );
    expect(plan).toEqual({ upload: ['up'], download: ['down'], remove: ['old-orphan'] });
  });

  it('round-trips photo bytes through encryption', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const data = new Uint8Array([255, 216, 255, 1, 2, 3]);
    const sealed = await sealBytes(key, data.buffer);
    expect([...sealed.slice(12)]).not.toEqual([...data]);
    expect(new Uint8Array(await openBytes(key, sealed))).toEqual(data);
  });
});
