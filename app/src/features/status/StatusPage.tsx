import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  bodyFatigue,
  countCleared,
  fatigueBand,
  getFatigue,
  getMonthly,
  getSkillState,
  getStreak,
  isComplete,
  muscleFatigue,
  questForDate,
  rankThresholdExp,
  RANKS,
  recoveryAdvice,
  SKILL_TREES,
  treeUnit,
} from '../../domain';
import { useApp } from '../../state/store';
import { Bar, Card, Sec } from '../../ui/components';
import { usePenalty, useRankInfo, useToday } from '../../ui/hooks';
import { fatigueColor } from '../body/BodyMap';

export function StatusPage() {
  const { player, logs, templates, questPool } = useApp();
  const today = useToday();
  const penalty = usePenalty();
  const { exp, rank } = useRankInfo();
  const todayLog = logs[today];
  const quest = todayLog?.dailyQuest ?? questForDate(today, { today, penalty, pool: questPool, logs });
  const compliance = getFatigue(logs, today);
  const streak = getStreak(logs, today);
  const monthly = getMonthly(logs, today);
  const muscles = useMemo(() => muscleFatigue(logs, templates), [logs, templates]);
  const body = bodyFatigue(muscles);
  const skills = useMemo(() => getSkillState(logs, templates), [logs, templates]);
  const [tree, setTree] = useState(SKILL_TREES[0]!.id);
  const activeTree = SKILL_TREES.find((t) => t.id === tree)!;
  const band = fatigueBand(compliance);
  const bandColor = band === 'deload' ? 'var(--gold)' : band === 'moderate' ? 'var(--glow)' : 'var(--grn)';

  return (
    <div className="page">
      <Card>
        <div className="rank-card">
          <div className="rank-big" style={{ color: rank.color, background: `${rank.color}12` }}>
            {rank.rank}
          </div>
          <div className="rank-detail">
            <div className="rank-name">{player?.name}</div>
            <div className="rank-sub" style={{ color: rank.color }}>
              LVL {rank.level} — {rank.title}
            </div>
            {rank.next ? (
              <>
                <div className="xp-labels">
                  <span>EXP</span>
                  <span>
                    {exp.toLocaleString()} / {rankThresholdExp(rank.next.min).toLocaleString()}
                  </span>
                </div>
                <Bar pct={rank.prog} color={rank.color} />
              </>
            ) : (
              <div className="rank-sub" style={{ color: 'var(--gold)' }}>
                MAX RANK · {exp.toLocaleString()} EXP
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-val" style={{ color: 'var(--glow)' }}>
            {countCleared(logs)}
          </div>
          <div className="stat-lbl">CLEARED</div>
        </div>
        <div className="stat-card">
          <div className="stat-val" style={{ color: '#ff8844' }}>
            {streak}
          </div>
          <div className="stat-lbl">DAY STREAK</div>
        </div>
        <div className="stat-card">
          <div className="stat-val" style={{ color: fatigueColor(Math.max(body, 30)) }}>
            {body}%
          </div>
          <div className="stat-lbl">BODY LOAD</div>
        </div>
      </div>

      {penalty && (
        <Card className="penalty-card">
          <div className="penalty-title">⚠ PENALTY ZONE</div>
          <p className="prose" style={{ marginTop: 6 }}>
            {band === 'deload' ? 'Missed quests are piling up. Complete the recovery protocol.' : 'Your streak broke. Complete survival training.'}
          </p>
          <Link className="btn btn-red" to="/quest" style={{ marginTop: 12 }}>
            ENTER PENALTY QUEST
          </Link>
        </Card>
      )}

      <Card>
        <Sec>{penalty ? 'MANDATORY CLEAR' : "TODAY'S QUEST"}</Sec>
        <div className="label" style={{ color: todayLog ? (isComplete(todayLog) ? 'var(--grn)' : 'var(--gold)') : 'var(--dim)' }}>
          {todayLog ? (isComplete(todayLog) ? '✓ QUEST COMPLETE' : '⚠ IN PROGRESS') : quest.name}
        </div>
        {quest.tasks.map((t) => {
          const v = Number(todayLog?.questProgress?.[t.id] ?? 0);
          return (
            <div className="kv" key={t.id}>
              <span>{t.label}</span>
              <span>
                {todayLog ? `${v} / ` : ''}
                {t.target} {t.unit}
              </span>
            </div>
          );
        })}
        {!isComplete(todayLog) && (
          <Link className="btn btn-grn" to="/quest" style={{ marginTop: 12 }}>
            {todayLog ? 'CONTINUE QUEST' : "BEGIN TODAY'S QUEST"}
          </Link>
        )}
      </Card>

      <Card>
        <Sec>CONDITION</Sec>
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="prose">Quest discipline (last 7 logs)</span>
          <span style={{ fontFamily: 'var(--hd)', color: bandColor }}>{100 - Math.round((compliance / 60) * 100)}%</span>
        </div>
        <Bar pct={100 - (compliance / 60) * 100} color={bandColor} />
        <p className="prose" style={{ marginTop: 12 }}>
          {recoveryAdvice(muscles)}
        </p>
        <Link className="btn btn-sm" to="/body" style={{ marginTop: 10 }}>
          OPEN MUSCLE MAP
        </Link>
      </Card>

      <Card>
        <Sec>MASTERY TREE</Sec>
        <div className="seg" role="tablist" aria-label="Skill tree">
          {SKILL_TREES.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === tree} className={t.id === tree ? 'active' : ''} onClick={() => setTree(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
        <div className="stack">
          {activeTree.nodes.map((node, i) => {
            const best = skills.best[node.id] ?? 0;
            const depsMet = (node.deps ?? []).every((d) => skills.unlocked[d]);
            const done = skills.unlocked[node.id];
            return (
              <div key={node.id} className={`skill-node ${done ? 'done' : depsMet ? 'ready' : 'locked'}`}>
                <div style={{ flex: 1 }}>
                  <div className="skill-tier">TIER {i + 1}</div>
                  <div className="skill-name" style={{ color: done ? 'var(--grn)' : depsMet ? 'var(--gold)' : 'var(--dim)' }}>
                    {node.label}
                  </div>
                  <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>
                    {depsMet ? `${best} / ${node.req} ${treeUnit(activeTree)}` : 'LOCKED'}
                  </div>
                </div>
                <div aria-hidden>{done ? '✓' : depsMet ? '○' : '🔒'}</div>
              </div>
            );
          })}
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          Log skill work with a "stage" exercise (see the Calisthenics Skills training type).
        </p>
      </Card>

      <Card>
        <Sec>30-DAY CHALLENGE</Sec>
        <div className="row">
          <span className="prose">Clear 30 quests this month</span>
          <span style={{ fontFamily: 'var(--hd)', fontSize: 16, color: monthly.unlocked ? 'var(--gold)' : 'var(--glow)' }}>
            {monthly.done}/{monthly.target}
          </span>
        </div>
        <div className="challenge-dots" aria-hidden>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} className={`ch-dot${i < monthly.done ? ' done' : ''}`} />
          ))}
        </div>
        {monthly.unlocked && (
          <div className="label" style={{ color: 'var(--gold)', marginTop: 10 }}>
            TITLE: MONARCH OF GRAVITY
          </div>
        )}
      </Card>

      <Card>
        <Sec>RANK LADDER</Sec>
        {RANKS.map((r) => {
          const reached = exp >= rankThresholdExp(r.min);
          return (
            <div key={r.level} className="rank-row" style={{ opacity: reached ? 1 : 0.35 }}>
              <div className="rank-badge-sm" style={{ color: r.color }}>
                {r.rank}
              </div>
              <div style={{ flex: 1, fontFamily: 'var(--hd)', fontSize: 10, color: r.color, letterSpacing: 1 }}>
                LVL {r.level} — {r.title}
              </div>
              <div className="muted" style={{ fontFamily: 'var(--hd)', fontSize: 9 }}>
                {rankThresholdExp(r.min).toLocaleString()}
              </div>
              <div style={{ color: 'var(--grn)', width: 14 }}>{reached ? '✓' : ''}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
