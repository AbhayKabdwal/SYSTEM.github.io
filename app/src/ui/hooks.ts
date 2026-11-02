import { useEffect, useMemo, useState } from 'react';
import { EXP_PER_RANK_POINT, getRank, isPenalty, todayStr, totalExp } from '../domain';
import { useApp } from '../state/store';
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

export function useRankInfo() {
  const logs = useApp((s) => s.logs);
  const templates = useApp((s) => s.templates);
  return useMemo(() => {
    const exp = totalExp(logs, templates);
    return { exp, rank: getRank(exp / EXP_PER_RANK_POINT) };
  }, [logs, templates]);
}

export function usePenalty() {
  const logs = useApp((s) => s.logs);
  const today = useToday();
  return useMemo(() => isPenalty(logs, today), [logs, today]);
}

const repo = createRepo();

/** Object URL for a stored photo; revoked on unmount. */
export function usePhotoUrl(id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
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
  }, [id]);
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
