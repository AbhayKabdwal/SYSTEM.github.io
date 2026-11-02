import {
  countCleared,
  getFatigue,
  getRank,
  getStreak,
  isPenalty,
  questForDate,
  todayStr,
} from '../../domain';
import type { AppData } from '../../data/legacyStorage';

// Phase 0 smoke screen: proves the domain modules run against real v1 data.
// The full Status tab is rebuilt in Phase 1.
export function StatusSummary({ data }: { data: AppData }) {
  const today = todayStr();
  const { logs, questPool, player } = data;
  const cleared = countCleared(logs);
  const rank = getRank(cleared);
  const penalty = isPenalty(logs, today);
  const quest = questForDate(today, { today, penalty, pool: questPool, logs });

  return (
    <main className="shell">
      <h1>◆ SYSTEM</h1>
      <p className="dim">React rebuild · Phase 0</p>
      <section className="card">
        <div className="row">
          <span>Hunter</span>
          <strong>{player?.name ?? 'No v1 data on this device'}</strong>
        </div>
        <div className="row">
          <span>Rank</span>
          <strong style={{ color: rank.color }}>
            {rank.rank} · LVL {rank.level} — {rank.title}
          </strong>
        </div>
        <div className="row">
          <span>Cleared days</span>
          <strong>{cleared}</strong>
        </div>
        <div className="row">
          <span>Streak</span>
          <strong>{getStreak(logs, today)}</strong>
        </div>
        <div className="row">
          <span>Fatigue</span>
          <strong>{getFatigue(logs)}%</strong>
        </div>
      </section>
      <section className={`card${penalty ? ' penalty' : ''}`}>
        <h2>{quest.name}</h2>
        {quest.tasks.map((t) => (
          <div className="row" key={t.id}>
            <span>{t.label}</span>
            <span className="dim">
              {t.target} {t.unit}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
