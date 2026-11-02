import { describe, expect, it } from 'vitest';
import { DEFAULT_QUEST_POOL, DEFAULT_TEMPLATES } from '../domain';
import { loadLegacyData } from './legacyStorage';

function memoryStorage(entries: Record<string, string>): Storage {
  const keys = Object.keys(entries);
  return {
    length: keys.length,
    key: (i) => keys[i] ?? null,
    getItem: (k) => entries[k] ?? null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

describe('loadLegacyData', () => {
  it('reads v1 keys and merges custom templates with defaults', () => {
    const data = loadLegacyData(
      memoryStorage({
        sl_player: JSON.stringify({ name: 'JINWOO', totalWorkouts: 3 }),
        sl_templates: JSON.stringify([{ id: 'tpl_chest', name: 'MY CHEST', color: '#f00', exercises: [] }]),
        'sl_log:2026-11-01': JSON.stringify({ questProgress: { pushups: 100 } }),
        'sl_log:2026-11-02': 'not json',
        unrelated: '1',
      }),
    );
    expect(data.player?.name).toBe('JINWOO');
    expect(data.templates[0]!.name).toBe('MY CHEST');
    expect(data.templates).toHaveLength(DEFAULT_TEMPLATES.length);
    expect(data.questPool).toEqual(DEFAULT_QUEST_POOL);
    expect(Object.keys(data.logs)).toEqual(['2026-11-01']);
  });

  it('returns defaults for an empty device', () => {
    const data = loadLegacyData(memoryStorage({}));
    expect(data.player).toBeNull();
    expect(data.logs).toEqual({});
  });
});
