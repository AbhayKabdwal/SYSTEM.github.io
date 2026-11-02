import { useMemo } from 'react';
import { addDays, dailyQuest, parseDateStr, questForDate, weekOf, type Quest, type Tier } from '../../domain';
import { useApp } from '../../state/store';
import { Card, Sec } from '../../ui/components';
import { fmtDate, useLedger, useToday } from '../../ui/hooks';
import { DAY_MARK } from '../status/StatusPage';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function PlanPage() {
  const { logs, questPool, player } = useApp();
  const ledger = useLedger();
  const today = useToday();
  const week = weekOf(today);
  const lastWeek = weekOf(addDays(today, -7));
  const cleared = (d: string) => ['verified', 'unverified'].includes(ledger.days[d]?.status ?? '');
  const clearedThisWeek = week.filter(cleared).length;
  const clearedLastWeek = lastWeek.filter(cleared).length;
  const prefs = player?.prefs;

  // Each generated day rotates away from the one before, so chain the forecast.
  const upcoming = useMemo(() => {
    const out: { date: string; quest: Quest }[] = [];
    let prev: Quest | undefined = logs[today]?.dailyQuest;
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const quest = prefs
        ? dailyQuest(date, { tier: ledger.tier as Tier, progress: ledger.rankProgress, prefs, yesterday: prev })
        : questForDate(date, { today, pool: questPool, logs });
      out.push({ date, quest });
      prev = quest;
    }
    return out;
  }, [logs, today, prefs, ledger.tier, ledger.rankProgress, questPool]);

  return (
    <div className="page">
      <Card>
        <Sec>THIS WEEK</Sec>
        <div className="week-grid">
          {week.map((d) => {
            const st = d > today ? 'future' : (ledger.days[d]?.status ?? 'future');
            const mark = DAY_MARK[st];
            return (
              <div key={d} className={`week-cell${cleared(d) ? ' done' : st === 'missed' ? ' miss' : ''}${d === today ? ' today' : ''}`}>
                <div className="week-day">{DAYS[(parseDateStr(d).getDay() + 6) % 7]}</div>
                <div className="week-date">{d.slice(8)}</div>
                <div style={{ marginTop: 4, fontSize: 13, color: mark.color }} aria-label={mark.label || 'upcoming'}>
                  {mark.icon || '·'}
                </div>
              </div>
            );
          })}
        </div>
        <div className="kv" style={{ marginTop: 10 }}>
          <span>Cleared this week</span>
          <span>{clearedThisWeek} / 7</span>
        </div>
        <div className="kv">
          <span>Last week</span>
          <span>{clearedLastWeek} / 7</span>
        </div>
      </Card>

      <Card>
        <Sec>UPCOMING GATES</Sec>
        <p className="hint" style={{ marginTop: -4, marginBottom: 8 }}>
          Forecast at your current rank. A missed day turns the next one into a penalty quest, and ranking up changes the exercises.
        </p>
        {upcoming.map(({ date: d, quest: q }) => {
          return (
            <div key={d} className="kv" style={{ display: 'block' }}>
              <div className="label" style={{ marginBottom: 3 }}>
                {fmtDate(d)}
              </div>
              <div style={{ color: 'var(--text)', textAlign: 'left' }}>{q.tasks.map((t) => `${t.label} ${t.target} ${t.unit}`).join(' · ')}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
