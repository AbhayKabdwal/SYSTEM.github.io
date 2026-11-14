import { registerPlugin } from '@capacitor/core';
import { useEffect } from 'react';
import type { Ledger, Quest } from '../domain';
import { isNative } from './platform';

interface WidgetBridge {
  update(data: { streak: number; level: number; rank: string; done: number; total: number; status: string; quest: string }): Promise<void>;
}

const Widget = registerPlugin<WidgetBridge>('WidgetBridge');

/** Keeps the Android home-screen widget showing today's streak and quest progress. */
export function useWidgetSync(ledger: Ledger, today: string, quest: Quest, progress: Record<string, string | number> | undefined) {
  const status = ledger.days[today]?.status ?? 'open';
  const done = quest.tasks.filter((t) => Number(progress?.[t.id] ?? 0) >= t.target).length;
  useEffect(() => {
    if (!isNative) return;
    const t = setTimeout(() => {
      void Widget.update({ streak: ledger.streak, level: ledger.level, rank: ledger.rank, done, total: quest.tasks.length, status, quest: quest.name }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(t);
  }, [ledger.streak, ledger.level, ledger.rank, done, quest.tasks.length, quest.name, status]);
}
