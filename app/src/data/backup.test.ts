import { describe, expect, it } from 'vitest';
import { BackupError, buildBackup, mergeLogs, parseBackup } from './backup';

let n = 0;
const ids = () => `p${++n}`;
const JPEG = 'data:image/jpeg;base64,/9j/AA==';

describe('parseBackup', () => {
  it('reads a v1 backup and lifts inline photos out of logs', () => {
    const parsed = parseBackup(
      {
        version: 1,
        player: { name: 'JINWOO', totalWorkouts: 3 },
        logs: { '2026-11-01': { questProgress: { pushups: '100' }, photos: [JPEG, null, 'not-a-photo'] } },
      },
      ids,
    );
    const log = parsed.logs['2026-11-01']!;
    expect(log.photos).toBeUndefined();
    expect(log.photoIds?.[0]).toMatch(/^p\d+$/);
    expect(log.photoIds?.slice(1)).toEqual([null, null]);
    expect(parsed.photos[log.photoIds![0]!]).toBe(JPEG);
  });

  it('round-trips a v2 backup', () => {
    const b = buildBackup({ player: { name: 'A' }, templates: [], questPool: [], logs: { '2026-11-01': { savedAt: 'x' } }, photos: { p: JPEG } });
    const parsed = parseBackup(JSON.parse(JSON.stringify(b)), ids);
    expect(parsed.logs['2026-11-01']?.savedAt).toBe('x');
    expect(parsed.photos.p).toBe(JPEG);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup({ hello: 1 }, ids)).toThrow(BackupError);
    expect(() => parseBackup({ version: 2, logs: { 'not-a-date': {} } }, ids)).toThrow(BackupError);
    expect(() => parseBackup({ version: 2, photos: { x: 'javascript:alert(1)' } }, ids)).toThrow(BackupError);
  });
});

describe('mergeLogs', () => {
  it('keeps the most recently saved version per day', () => {
    const ours = { a: { savedAt: '2026-11-01T10:00Z' }, b: { savedAt: '2026-11-01T10:00Z' } };
    const theirs = { a: { savedAt: '2026-11-01T09:00Z' }, b: { savedAt: '2026-11-01T11:00Z' }, c: { savedAt: '2026-11-01T08:00Z' } };
    const m = mergeLogs(ours, theirs);
    expect(m.a).toBe(ours.a);
    expect(m.b).toBe(theirs.b);
    expect(m.c).toBe(theirs.c);
  });

  it('considers training saves too', () => {
    const m = mergeLogs({ a: { savedAt: '1', trainingSavedAt: '5' } }, { a: { savedAt: '4' } });
    expect(m.a?.trainingSavedAt).toBe('5');
  });
});
