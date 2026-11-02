import { addDays, isComplete, parseDateStr, questForDate, weekOf } from '../../domain';
import { useApp } from '../../state/store';
import { Card, Sec } from '../../ui/components';
import { fmtDate, useToday } from '../../ui/hooks';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function PlanPage() {
  const { logs, questPool } = useApp();
  const today = useToday();
  const week = weekOf(today);
  const lastWeek = weekOf(addDays(today, -7));
  const upcoming = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  const clearedThisWeek = week.filter((d) => isComplete(logs[d])).length;
  const clearedLastWeek = lastWeek.filter((d) => isComplete(logs[d])).length;

  return (
    <div className="page">
      <Card>
        <Sec>THIS WEEK</Sec>
        <div className="week-grid">
          {week.map((d) => {
            const done = isComplete(logs[d]);
            const missed = d < today && !done;
            return (
              <div key={d} className={`week-cell${done ? ' done' : missed ? ' miss' : ''}${d === today ? ' today' : ''}`}>
                <div className="week-day">{DAYS[(parseDateStr(d).getDay() + 6) % 7]}</div>
                <div className="week-date">{d.slice(8)}</div>
                <div style={{ marginTop: 4, fontSize: 13 }} aria-label={done ? 'cleared' : missed ? 'missed' : 'open'}>
                  {done ? '✓' : missed ? '✗' : '·'}
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
          Quests are fixed per date. A missed day turns the next one into a penalty quest.
        </p>
        {upcoming.map((d) => {
          const q = questForDate(d, { today, pool: questPool, logs });
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
