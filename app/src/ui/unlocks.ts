import { useEffect } from 'react';
import { LORE, newUnlocks, type Feature } from '../domain';
import { systemAlert } from './notify';
import { showGuides } from './FeatureGuide';
import { play } from './sound';

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
    // Read, record and announce in one step after a short delay: if the effect re-runs
    // in between (React may run it twice), the cancelled run hasn't marked anything seen.
    const t = setTimeout(() => {
      const seen = read<Feature[] | null>(SEEN_UNLOCKS, null);
      const fresh = newUnlocks(level, seen ?? []);
      const loreSeen = read<number>(SEEN_LORE, 0);
      const lore = LORE.filter((l) => l.level <= level && l.level > loreSeen);
      // Always record on first run, even when nothing is unlocked yet, so a brand-new
      // hunter's first level-up is announced instead of being mistaken for a first run.
      if (fresh.length || !seen) write(SEEN_UNLOCKS, [...(seen ?? []), ...fresh.map((u) => u.feature)]);
      if (lore.length) write(SEEN_LORE, Math.max(...lore.map((l) => l.level)));
      if (!seen) return; // first run: don't flood an existing player with notices
      if (fresh.length) {
        play('fanfare');
        showGuides(fresh.map((u) => u.feature));
      } else if (lore.length) {
        const l = lore[lore.length - 1]!;
        systemAlert(`SYSTEM ARCHIVE: ${l.title.toUpperCase()}\n${l.text}`);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [level, ready]);
}
