import { useEffect, useMemo, useState } from 'react';
import { computeLedger, questForDate, todayStr, type Ledger, type Quest, type Tier } from '../domain';
import { useApp } from '../state/store';
import { useSession } from '../state/session';
import { createRepo } from '../data/repo';

/** Today's local date, refreshed when the day rolls over or the app is reopened. */
export function useToday() {
  const [today, setToday] = useState(todayStr);
  useEffect(() => {
    const tick = () => setToday(todayStr());
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}

/** Replayed game state: EXP, level, rank, streak, penalties. */
export function useLedger(): Ledger {
  const logs = useApp((s) => s.logs);
  const templates = useApp((s) => s.templates);
  const player = useApp((s) => s.player);
  const today = useToday();
  return useMemo(() => computeLedger(logs, templates, player, today), [logs, templates, player, today]);
}

export const usePenalty = () => useLedger().penaltyToday;

/** The quest for a date: the stored one if the day was saved, otherwise generated. */
export function useQuestFor(date: string, ledger: Ledger): Quest {
  const logs = useApp((s) => s.logs);
  const questPool = useApp((s) => s.questPool);
  const prefs = useApp((s) => s.player?.prefs);
  const today = useToday();
  const saved = logs[date]?.dailyQuest;
  return useMemo(
    () =>
      saved ??
      questForDate(date, {
        today,
        penalty: date === today && ledger.penaltyToday,
        pool: questPool,
        logs,
        prefs,
        tier: ledger.tier as Tier,
        progress: ledger.rankProgress,
      }),
    [saved, date, today, ledger.penaltyToday, ledger.tier, ledger.rankProgress, questPool, logs, prefs],
  );
}

const repo = createRepo();

/** Object URL for a stored photo; revoked on unmount. */
export function usePhotoUrl(id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  // Re-read when synced photos arrive from another device.
  const photoRev = useSession((s) => s.photoRev);
  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void repo.getPhoto(id).then((row) => {
      if (cancelled || !row) return;
      objectUrl = URL.createObjectURL(row.blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, photoRev]);
  return url;
}

export function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y!, m! - 1, day!, 12).toLocaleDateString(undefined, opts);
}

export function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
