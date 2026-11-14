import { useEffect } from 'react';
import { LORE, newUnlocks, type Feature } from '../domain';
import { systemAlert } from './notify';

const SEEN_UNLOCKS = 'sys:seenUnlocks';
const SEEN_LORE = 'sys:seenLore';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked */
  }
}

/**
 * Announces features and lore as the level reaches them. On first run with an existing
 * high-level hunter, everything already reached is marked seen with one summary.
 */
export function useUnlockNotices(level: number, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const seen = read<Feature[] | null>(SEEN_UNLOCKS, null);
    const fresh = newUnlocks(level, seen ?? []);
    const loreSeen = read<number>(SEEN_LORE, 0);
    const lore = LORE.filter((l) => l.level <= level && l.level > loreSeen);
    if (fresh.length) write(SEEN_UNLOCKS, [...(seen ?? []), ...fresh.map((u) => u.feature)]);
    if (lore.length) write(SEEN_LORE, Math.max(...lore.map((l) => l.level)));
    if (!seen) return; // first run: don't flood an existing player with notices
    const t = setTimeout(() => {
      if (fresh.length === 1) systemAlert(`NEW FEATURE UNLOCKED\n${fresh[0]!.name.toUpperCase()}\n${fresh[0]!.blurb}`);
      else if (fresh.length > 1) systemAlert(`NEW FEATURES UNLOCKED\n${fresh.map((u) => u.name).join(' · ')}`);
      else if (lore.length) {
        const l = lore[lore.length - 1]!;
        systemAlert(`SYSTEM ARCHIVE: ${l.title.toUpperCase()}\n${l.text}`);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [level, ready]);
}
