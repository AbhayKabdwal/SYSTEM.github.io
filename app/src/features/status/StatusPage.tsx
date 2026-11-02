import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  bodyFatigue,
  EXP,
  flameFor,
  FLAMES,
  getMonthly,
  getSkillState,
  isComplete,
  muscleFatigue,
  RANK_GATES,
  RANKS,
  recoveryAdvice,
  restAvailable,
  SKILL_TREES,
  STREAK_MILESTONES,
  treeUnit,
  weekOf,
  type DayStatus,
  type Ledger,
} from '../../domain';
import { useApp } from '../../state/store';
import { Bar, Card, Sec } from '../../ui/components';
import { fmtDate, useLedger, useQuestFor, useToday } from '../../ui/hooks';
import { fatigueColor } from '../body/BodyMap';

export const DAY_MARK: Record<DayStatus | 'future', { icon: string; label: string; color: string }> = {
  verified: { icon: '✓', label: 'Cleared with proof', color: 'var(--grn)' },
  unverified: { icon: '◐', label: 'Cleared, no proof', color: 'var(--gold)' },
  rest: { icon: '☾', label: 'Rest day', color: 'var(--glow)' },
  missed: { icon: '✗', label: 'Missed', color: 'var(--red)' },
  open: { icon: '•', label: 'Today', color: 'var(--bright)' },
  future: { icon: '', label: '', color: 'var(--dim)' },
};

export function StatusPage() {
  const { player, logs, templates } = useApp();
  const today = useToday();
  const ledger = useLedger();
  const quest = useQuestFor(today, ledger);
  const todayLog = logs[today];
  const muscles = useMemo(() => muscleFatigue(logs, templates, new Date(), ledger.tier), [logs, templates, ledger.tier, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const body = bodyFatigue(muscles);
  const monthly = getMonthly(logs, today);
  const todayStatus = ledger.days[today]?.status ?? 'open';

  return (
    <div className="page">
      {!player?.prefs && (
        <Card className="calib-card">
          <Sec>SYSTEM CALIBRATION REQUIRED</Sec>
          <p className="prose">Answer six questions and the System will build quests for your goals, equipment and level, getting harder as you rank up.</p>
          <Link className="btn btn-gold" to="/calibrate" style={{ marginTop: 10 }}>
            CALIBRATE NOW
          </Link>
        </Card>
      )}

      <StatusWindow ledger={ledger} name={player?.name ?? ''} body={body} />

      {ledger.penaltyToday && (
        <Card className="penalty-card">
          <div className="penalty-title">⚠ PENALTY ZONE</div>
          <p className="prose" style={{ marginTop: 6 }}>
            Yesterday's quest was failed: −{EXP.missBase + EXP.missPerTier * ledger.tier} EXP.
            {ledger.repairableStreak > 0 && todayStatus !== 'verified'
              ? ` Clear today's penalty quest and attach proof to restore your ${ledger.repairableStreak}-day streak.`
              : ' Survive the penalty quest to get back on track.'}
          </p>
          {todayStatus !== 'verified' && (
            <Link className="btn btn-red" to="/quest" style={{ marginTop: 12 }}>
              ENTER PENALTY QUEST
            </Link>
          )}
        </Card>
      )}

      <StreakCard ledger={ledger} today={today} />

      <Card>
        <Sec>{ledger.penaltyToday ? 'MANDATORY CLEAR' : "TODAY'S QUEST"}</Sec>
        <div className="label" style={{ color: DAY_MARK[todayStatus].color }}>
          {todayStatus === 'verified'
            ? '✓ QUEST COMPLETE · PROOF ATTACHED'
            : todayStatus === 'unverified'
              ? '◐ CLEARED · ATTACH PROOF FOR FULL EXP'
              : todayStatus === 'rest'
                ? '☾ REST DAY'
                : todayLog
                  ? '⚠ IN PROGRESS'
                  : quest.name}
        </div>
        {todayStatus !== 'rest' &&
          quest.tasks.map((t) => {
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
        {todayStatus !== 'verified' && todayStatus !== 'rest' && (
          <Link className="btn btn-grn" to="/quest" style={{ marginTop: 12 }}>
            {todayStatus === 'unverified' ? 'ATTACH PROOF' : isComplete(todayLog) ? 'OPEN QUEST' : todayLog ? 'CONTINUE QUEST' : "BEGIN TODAY'S QUEST"}
          </Link>
        )}
        {todayStatus === 'verified' && <p className="hint">Earned +{ledger.days[today]?.total ?? 0} EXP today.</p>}
      </Card>

      {player?.prefs && <SideQuestCards ledger={ledger} today={today} />}

      <Card>
        <Sec>CONDITION</Sec>
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="prose">Body load</span>
          <span style={{ fontFamily: 'var(--hd)', color: fatigueColor(Math.max(body, 30)) }}>{body}%</span>
        </div>
        <Bar pct={body} color={fatigueColor(Math.max(body, 30))} />
        <p className="prose" style={{ marginTop: 12 }}>
          {recoveryAdvice(muscles)}
        </p>
        <Link className="btn btn-sm" to="/body" style={{ marginTop: 10 }}>
          OPEN MUSCLE MAP
        </Link>
      </Card>

      <SystemLog ledger={ledger} />

      <SkillTreeCard />

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

      <RankLadder ledger={ledger} />
    </div>
  );
}

function StatusWindow({ ledger, name, body }: { ledger: Ledger; name: string; body: number }) {
  const s = ledger.stats;
  const stats: [string, number, string][] = [
    ['STR', s.str, 'Strength: push, pull and leg work'],
    ['AGI', s.agi, 'Agility: cardio and conditioning'],
    ['VIT', s.vit, 'Vitality: quests cleared and longest streak'],
    ['SEN', s.sen, 'Sense: core, control and skill work'],
    ['INT', s.int, 'Intelligence: proof, recovery and smart rest'],
  ];
  return (
    <Card className="status-window">
      <div className="sw-head">
        <span>STATUS</span>
      </div>
      <div className="rank-card">
        <div className="rank-big" style={{ color: ledger.rankColor, background: `${ledger.rankColor}12` }}>
          {ledger.rank}
        </div>
        <div className="rank-detail">
          <div className="rank-name">{name}</div>
          <div className="rank-sub" style={{ color: ledger.title.color }}>
            LVL {ledger.level} — {ledger.title.title}
          </div>
          <div className="xp-labels">
            <span>EXP</span>
            <span>{ledger.levelNext ? `${(ledger.exp - ledger.levelStart).toLocaleString()} / ${(ledger.levelNext - ledger.levelStart).toLocaleString()}` : 'MAX'}</span>
          </div>
          <Bar pct={ledger.levelProg} color={ledger.rankColor} />
          <div className="hint" style={{ marginTop: 4 }}>
            {ledger.exp.toLocaleString()} total · {ledger.weekExp >= 0 ? '+' : ''}
            {ledger.weekExp.toLocaleString()} this week
          </div>
        </div>
      </div>
      <div className="stat-grid stat-grid-6">
        {stats.map(([k, v, title]) => (
          <div className="stat-card" key={k} title={title}>
            <div className="stat-val">{v}</div>
            <div className="stat-lbl">{k}</div>
          </div>
        ))}
        <div className="stat-card" title="Fatigue: current body load from the muscle map">
          <div className="stat-val" style={{ color: fatigueColor(Math.max(body, 30)) }}>
            {body}
          </div>
          <div className="stat-lbl">FATIGUE</div>
        </div>
      </div>
    </Card>
  );
}

function StreakCard({ ledger, today }: { ledger: Ledger; today: string }) {
  const flame = flameFor(ledger.streak);
  const nextFlame = FLAMES.find((f) => f.min > ledger.streak);
  const nextMilestone = STREAK_MILESTONES.find((m) => m > ledger.streak);
  const week = weekOf(today);
  const restFree = restAvailable(ledger, today);
  return (
    <Card className="streak-card">
      <Sec>STREAK</Sec>
      <div className="streak-main">
        <div className="flame" style={{ color: flame.color, textShadow: `0 0 18px ${flame.color}` }} aria-hidden>
          🔥
        </div>
        <div style={{ flex: 1 }}>
          <div className="streak-num" style={{ color: flame.color }}>
            {ledger.streak} <span>DAY{ledger.streak === 1 ? '' : 'S'}</span>
          </div>
          <div className="label" style={{ color: flame.color, marginBottom: 0 }}>
            {flame.name.toUpperCase()}
            {nextFlame ? ` · ${nextFlame.name} at ${nextFlame.min}` : ''}
          </div>
        </div>
        <div className="mult" title="EXP multiplier on your next verified clear">
          ×{ledger.nextMult.toFixed(2)}
          <span>EXP</span>
        </div>
      </div>
      <div className="week-strip" aria-label="This week">
        {week.map((d) => {
          const st = d > today ? 'future' : (ledger.days[d]?.status ?? 'future');
          const mark = DAY_MARK[st];
          return (
            <div key={d} className={`wk-day${d === today ? ' today' : ''}`} title={`${fmtDate(d)}: ${mark.label}`}>
              <span className="wk-name">{fmtDate(d, { weekday: 'narrow' })}</span>
              <span className="wk-mark" style={{ color: mark.color, borderColor: mark.color }}>
                {mark.icon}
              </span>
            </div>
          );
        })}
      </div>
      <div className="kv">
        <span>Momentum (days without resting)</span>
        <span>
          {ledger.chain} · +{(Math.min(ledger.chain, EXP.chainCap) * EXP.chainStep * 100).toFixed(1)}%
        </span>
      </div>
      <div className="kv">
        <span>Streak bonus</span>
        <span>+{Math.min(ledger.streak, EXP.streakCap)}%</span>
      </div>
      <div className="kv">
        <span>Rest day this week</span>
        <span style={{ color: restFree ? 'var(--grn)' : 'var(--dim)' }}>{ledger.days[today]?.status === 'rest' ? 'Taken today' : restFree ? 'Available' : 'Used'}</span>
      </div>
      <div className="kv">
        <span>Best streak</span>
        <span>{ledger.bestStreak}</span>
      </div>
      {nextMilestone && (
        <p className="hint" style={{ marginTop: 8 }}>
          {nextMilestone - ledger.streak} more day{nextMilestone - ledger.streak === 1 ? '' : 's'} to the {nextMilestone}-day milestone (+{EXP.milestonePerDay * nextMilestone} EXP). Resting keeps
          your streak but resets momentum, so a perfect 7/7 week pays the most.
        </p>
      )}
    </Card>
  );
}

function SideQuestCards({ ledger, today }: { ledger: Ledger; today: string }) {
  const logs = useApp((s) => s.logs);
  const next = RANK_GATES[ledger.tier + 1];
  const dungeonDone = ledger.dungeonWeeks.has(weekOf(today)[0]!);
  return (
    <>
      {ledger.trialReady && next && (
        <Card className="trial-card">
          <Sec>RANK-UP TRIAL AVAILABLE</Sec>
          <p className="prose">
            You've reached level {next.level}. Clear the {next.rank}-Rank trial to be promoted: quests move to harder variations and pay more EXP.
          </p>
          <Link className="btn btn-gold" to="/quest" state={{ focus: 'trial' }} style={{ marginTop: 10 }}>
            {logs[today]?.side?.trial ? 'CONTINUE TRIAL' : 'ENTER THE TRIAL'}
          </Link>
        </Card>
      )}
      {!dungeonDone && (
        <Card className="dungeon-card">
          <Sec>WEEKLY INSTANT DUNGEON</Sec>
          <p className="prose">An optional boss run, once a week: five exercises at higher volume for +{EXP.dungeonBase + EXP.dungeonPerTier * ledger.tier} EXP.</p>
          <Link className="btn btn-sm" to="/quest" state={{ focus: 'dungeon' }} style={{ marginTop: 10 }}>
            {logs[today]?.side?.dungeon ? 'CONTINUE DUNGEON' : 'ENTER DUNGEON'}
          </Link>
        </Card>
      )}
    </>
  );
}

function SystemLog({ ledger }: { ledger: Ledger }) {
  const events = ledger.events.slice(0, 8);
  if (!events.length) return null;
  return (
    <Card>
      <Sec>SYSTEM LOG</Sec>
      {events.map((e, i) => (
        <div className="log-row" key={i}>
          <span className="log-date">{fmtDate(e.date, { month: 'short', day: 'numeric' })}</span>
          <span className={`log-text log-${e.kind}`}>{e.text}</span>
          {e.exp !== 0 && <span className={`log-exp${e.exp < 0 ? ' neg' : ''}`}>{e.exp > 0 ? `+${e.exp}` : e.exp}</span>}
        </div>
      ))}
    </Card>
  );
}

function SkillTreeCard() {
  const { logs, templates } = useApp();
  const skills = useMemo(() => getSkillState(logs, templates), [logs, templates]);
  const [tree, setTree] = useState(SKILL_TREES[0]!.id);
  const activeTree = SKILL_TREES.find((t) => t.id === tree)!;
  return (
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
  );
}

function RankLadder({ ledger }: { ledger: Ledger }) {
  return (
    <Card>
      <Sec>RANK LADDER</Sec>
      <p className="hint" style={{ marginTop: -4, marginBottom: 8 }}>
        Level comes from EXP. Each rank also needs its trial cleared.
      </p>
      {RANKS.map((r) => {
        const reached = ledger.level >= r.min;
        const tierIdx = RANK_GATES.findIndex((g) => g.rank === r.rank);
        const gate = RANK_GATES[tierIdx]!;
        const locked = reached && tierIdx > ledger.tier;
        return (
          <div key={r.level} className="rank-row" style={{ opacity: reached ? 1 : 0.35 }}>
            <div className="rank-badge-sm" style={{ color: r.color }}>
              {r.rank}
            </div>
            <div style={{ flex: 1, fontFamily: 'var(--hd)', fontSize: 10, color: r.color, letterSpacing: 1 }}>
              LVL {r.level} — {r.title}
              {gate.level === r.level && tierIdx > 0 ? ' · TRIAL' : ''}
            </div>
            <div style={{ color: locked ? 'var(--gold)' : 'var(--grn)', width: 14 }}>{locked ? '⚔' : reached ? '✓' : ''}</div>
          </div>
        );
      })}
    </Card>
  );
}
