import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  bossFor,
  bossHp,
  CLASS_STAT,
  EXP,
  flameFor,
  FLAMES,
  getSkillState,
  ITEMS,
  JOB_DAYS,
  JOB_LEVEL,
  lastWeekStart,
  loreUnlocked,
  monthDamage,
  monthOf,
  RANK_GATES,
  RANKS,
  restAvailable,
  SKILL_TREES,
  SOURCE_LABEL,
  STAT_PATTERNS,
  STREAK_MILESTONES,
  treeUnit,
  weekOf,
  weeklyReport,
  type ItemKind,
  type JobClass,
  type Ledger,
  type StatKey,
} from '../../domain';
import { cloudEnabled } from '../../cloud/client';
import { bossStatus } from '../../cloud/competition';
import { useApp } from '../../state/store';
import { useSession } from '../../state/session';
import { Card, Sec } from '../../ui/components';
import { Collapsible } from '../../ui/Collapsible';
import { fmtDate } from '../../ui/hooks';
import { systemAlert, toast } from '../../ui/notify';
import { fatigueColor } from '../body/BodyMap';
import { DAY_MARK } from './marks';

export function StreakCard({ ledger, today }: { ledger: Ledger; today: string }) {
  const flame = flameFor(ledger.streak);
  const nextFlame = FLAMES.find((f) => f.min > ledger.streak);
  const nextMilestone = STREAK_MILESTONES.find((m) => m > ledger.streak);
  const week = weekOf(today);
  const restFree = restAvailable(ledger, today);
  return (
    <Card className="streak-card">
      <div className="streak-main">
        <div className="flame" style={{ color: flame.color, textShadow: `0 0 18px ${flame.color}` }} aria-hidden>
          🔥
        </div>
        <div style={{ flex: 1 }}>
          <div className="streak-num" style={{ color: flame.color }}>
            {ledger.streak} <span>DAY STREAK</span>
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
      <details className="details">
        <summary>How streaks pay</summary>
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
      </details>
    </Card>
  );
}

export function SideQuestCards({ ledger, today }: { ledger: Ledger; today: string }) {
  const { logs, player, setPlayer } = useApp();
  const next = RANK_GATES[ledger.tier + 1];
  const dungeonDone = ledger.dungeonWeeks.has(weekOf(today)[0]!);
  const dungeonsOpen = ledger.level >= 4;
  const jobOpen = ledger.level >= JOB_LEVEL && !player?.jobClass;
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
      {jobOpen && !ledger.jobReady && (
        <Card className="trial-card">
          <Sec>JOB CHANGE QUEST</Sec>
          <p className="prose">
            Prove your path: clear the Job Change quest on {JOB_DAYS} separate days ({ledger.jobProgress}/{JOB_DAYS} done), then choose your class.
          </p>
          <Link className="btn btn-gold" to="/quest" state={{ focus: 'job' }} style={{ marginTop: 10 }}>
            {logs[today]?.side?.job ? 'CONTINUE' : 'BEGIN TODAY'}
          </Link>
        </Card>
      )}
      {ledger.jobReady && player && (
        <Card className="trial-card">
          <Sec>CHOOSE YOUR CLASS</Sec>
          <p className="prose">This can't be undone. Your class tilts which exercises appear and adds +5 to its stat.</p>
          {(
            [
              ['fighter', 'FIGHTER', 'Strength: more push, pull and leg work. +5 STR.'],
              ['assassin', 'ASSASSIN', 'Agility: more cardio and conditioning. +5 AGI.'],
              ['mage', 'MAGE', 'Sense: more core, control and mobility. +5 SEN.'],
            ] as [JobClass, string, string][]
          ).map(([c, name, text]) => (
            <button
              key={c}
              className="list-item"
              onClick={async () => {
                if (!confirm(`Become a ${name}? This is permanent.`)) return;
                await setPlayer({ ...player, jobClass: c });
                systemAlert(`JOB CHANGE COMPLETE\nYOU ARE NOW A ${name}`);
              }}
            >
              <div>
                <div className="list-title">{name}</div>
                <div className="list-sub">{text}</div>
              </div>
            </button>
          ))}
        </Card>
      )}
      {dungeonsOpen && !dungeonDone && (
        <Card className="dungeon-card">
          <Sec>{ledger.dungeonBreak ? '⚠ DUNGEON BREAK' : 'WEEKLY INSTANT DUNGEON'}</Sec>
          <p className="prose">
            {ledger.dungeonBreak
              ? `Last week's gate was ignored and has broken open: 25% harder, +${Math.round((EXP.dungeonBase + EXP.dungeonPerTier * ledger.tier) * EXP.dungeonBreakMult)} EXP.`
              : `An optional boss run, once a week: five exercises at higher volume for +${EXP.dungeonBase + EXP.dungeonPerTier * ledger.tier} EXP and a shadow.`}
          </p>
          <Link className="btn btn-sm" to="/quest" state={{ focus: 'dungeon' }} style={{ marginTop: 10 }}>
            {logs[today]?.side?.dungeon ? 'CONTINUE DUNGEON' : 'ENTER DUNGEON'}
          </Link>
        </Card>
      )}
    </>
  );
}

const STAT_INFO: [StatKey, string, string][] = [
  ['str', 'STR', 'push, pull and leg work'],
  ['agi', 'AGI', 'cardio and conditioning'],
  ['vit', 'VIT', 'quests cleared, streaks; points add volume'],
  ['sen', 'SEN', 'core, control and skills'],
  ['int', 'INT', 'proof, recovery, check-ins'],
];

export function StatsCard({ ledger, body }: { ledger: Ledger; body: number }) {
  const { player, setPlayer } = useApp();
  const alloc = player?.statAlloc ?? {};
  const free = ledger.statPoints.free;
  const spend = async (k: StatKey, d: number) => {
    // Read the latest player, not this render's, so quick taps all count.
    const p = useApp.getState().player;
    if (!p) return;
    const a = p.statAlloc ?? {};
    const spent = Object.values(a).reduce((sum, n) => sum + (n ?? 0), 0);
    const cur = a[k] ?? 0;
    if (d > 0 && spent >= ledger.statPoints.total) return;
    if (d < 0 && cur <= 0) return;
    await setPlayer({ ...p, statAlloc: { ...a, [k]: cur + d } });
  };
  return (
    <Collapsible
      id="stats"
      title="STATS"
      icon="◈"
      summary={free ? `${free} point${free === 1 ? '' : 's'} to spend` : `STR ${ledger.stats.str} · AGI ${ledger.stats.agi} · VIT ${ledger.stats.vit}`}
      accent={free ? 'rgba(255, 215, 0, 0.5)' : undefined}
    >
      <div className="stat-grid stat-grid-6">
        {STAT_INFO.map(([k, label]) => (
          <div className="stat-card" key={k}>
            <div className="stat-val">{ledger.stats[k]}</div>
            <div className="stat-lbl">{label}</div>
          </div>
        ))}
        <div className="stat-card" title="Current body load from the muscle map">
          <div className="stat-val" style={{ color: fatigueColor(Math.max(body, 30)) }}>
            {body}
          </div>
          <div className="stat-lbl">FATIGUE</div>
        </div>
      </div>
      {player?.jobClass && (
        <p className="hint">
          Class: <b style={{ color: 'var(--gold)' }}>{player.jobClass.toUpperCase()}</b> (+5 {CLASS_STAT[player.jobClass].toUpperCase()})
        </p>
      )}
      <div className="label" style={{ marginTop: 12 }}>
        STAT POINTS · {free} FREE OF {ledger.statPoints.total}
      </div>
      {STAT_INFO.map(([k, label, text]) => (
        <div className="alloc-row" key={k}>
          <b>{label}</b>
          <span>
            {alloc[k] ?? 0} spent · {text}
            {STAT_PATTERNS[k].length ? ' · tilts quests' : ''}
          </span>
          <button className="icon-btn" aria-label={`Remove a point from ${label}`} disabled={!(alloc[k] ?? 0)} onClick={() => void spend(k, -1)}>
            −
          </button>
          <button className="icon-btn" aria-label={`Add a point to ${label}`} disabled={!free} onClick={() => void spend(k, 1)}>
            +
          </button>
        </div>
      ))}
      <p className="hint" style={{ marginTop: 8 }}>
        Base stats grow from what you actually train. Points you spend are added on top and nudge which exercises your quests pick.
      </p>
    </Collapsible>
  );
}

export function ReportCard({ ledger, today }: { ledger: Ledger; today: string }) {
  const { logs, templates } = useApp();
  const start = lastWeekStart(today);
  const report = useMemo(() => weeklyReport(ledger, logs, templates, start), [ledger, logs, templates, start]);
  if (!ledger.days[start] && !Object.keys(ledger.days).some((d) => d >= start && d < weekOf(today)[0]!)) return null;
  return (
    <Collapsible id="report" title="WEEKLY REPORT" icon="▤" summary={`Grade ${report.grade} · ${report.verified}/7 verified`}>
      <Link to="/report" className="btn btn-sm">
        OPEN LAST WEEK'S REPORT
      </Link>
    </Collapsible>
  );
}

export function InventoryCard({ ledger, today }: { ledger: Ledger; today: string }) {
  const { logs, saveLog } = useApp();
  const inv = ledger.inventory;
  const todayLog = logs[today];
  const scrollOn = !!todayLog?.items?.scroll;
  return (
    <Collapsible id="inventory" title="INVENTORY" icon="⚱" summary={`🛡${inv.shield} ⚗${inv.elixir} 📜${inv.scroll}`}>
      <div className="inv-grid">
        {(Object.keys(ITEMS) as ItemKind[]).map((k) => (
          <div className="inv-item" key={k} title={ITEMS[k].text}>
            <div className="inv-icon" aria-hidden>
              {ITEMS[k].icon}
            </div>
            <div className="inv-n">{inv[k]}</div>
            <div className="hint" style={{ marginTop: 2 }}>
              {ITEMS[k].name}
            </div>
          </div>
        ))}
      </div>
      {(Object.keys(ITEMS) as ItemKind[]).map((k) => (
        <p className="hint" key={k}>
          <b>{ITEMS[k].name}:</b> {ITEMS[k].text} <i>From: {ITEMS[k].source}.</i>
        </p>
      ))}
      {(inv.scroll > 0 || scrollOn) && (
        <button
          className={`btn btn-sm ${scrollOn ? '' : 'btn-gold'}`}
          style={{ marginTop: 8 }}
          onClick={async () => {
            await saveLog(today, { ...(todayLog ?? {}), items: { ...todayLog?.items, scroll: !scrollOn }, savedAt: todayLog?.savedAt ?? new Date().toISOString() });
            toast(scrollOn ? 'SCROLL PUT AWAY' : 'EXP SCROLL ACTIVE TODAY');
          }}
        >
          {scrollOn ? 'DON’T USE THE SCROLL TODAY' : '📜 USE AN EXP SCROLL TODAY'}
        </button>
      )}
    </Collapsible>
  );
}

export function ArmyCard({ ledger }: { ledger: Ledger }) {
  const wounded = ledger.shadows.filter((s) => s.wounded).length;
  return (
    <Collapsible id="army" title="SHADOW ARMY" icon="♟" summary={`${ledger.shadows.length} shadow${ledger.shadows.length === 1 ? '' : 's'}${wounded ? ` · ${wounded} wounded` : ''}`}>
      {!ledger.shadows.length ? (
        <p className="prose muted">Clear a perfect week, a dungeon or a rank trial to extract your first shadow.</p>
      ) : (
        <div className="shadow-grid">
          {[...ledger.shadows].reverse().map((s) => (
            <div key={s.id} className={`shadow-card${s.wounded ? ' wounded' : ''}`} title={`${SOURCE_LABEL[s.source]}, ${fmtDate(s.date)}`}>
              <div className="sh-glyph" aria-hidden>
                ♞
              </div>
              <div className="sh-name">{s.name}</div>
              <div className="hint" style={{ marginTop: 2 }}>
                {s.rank}-Rank{s.wounded ? ' · wounded' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="hint" style={{ marginTop: 8 }}>
        A week with a missed day wounds your newest shadow. A perfect week heals the whole army.
      </p>
    </Collapsible>
  );
}

const BOSS_KEY = 'sys:bossJoined';

export const bossJoined = () => {
  try {
    return localStorage.getItem(BOSS_KEY) === '1';
  } catch {
    return false;
  }
};

export function BossCard({ ledger, today }: { ledger: Ledger; today: string }) {
  const { logs, templates } = useApp();
  const user = useSession((s) => s.user);
  const month = monthOf(today);
  const boss = bossFor(month);
  const mine = useMemo(() => monthDamage(ledger, logs, templates, today), [ledger, logs, templates, today]);
  const [joined, setJoined] = useState(bossJoined);
  const [status, setStatus] = useState<{ total: number; participants: number } | null>(null);

  useEffect(() => {
    if (!cloudEnabled || !user || !joined) return;
    let cancelled = false;
    bossStatus(month)
      .then((s) => !cancelled && setStatus(s))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, joined, month, mine]);

  const hp = bossHp(status?.participants ?? 1);
  const dealt = status?.total ?? mine;
  const left = Math.max(0, hp - dealt);
  return (
    <Collapsible id="boss" title="MONTHLY BOSS" icon="☠" summary={joined ? (left ? `${Math.round((dealt / hp) * 100)}% damaged` : 'SLAIN') : boss.name}>
      <div className="label" style={{ color: 'var(--red)' }}>
        {boss.name.toUpperCase()}
      </div>
      <div className="boss-bar" role="progressbar" aria-valuenow={Math.round((left / hp) * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${(left / hp) * 100}%` }} />
      </div>
      <div className="kv">
        <span>HP left</span>
        <span>
          {left.toLocaleString()} / {hp.toLocaleString()}
        </span>
      </div>
      <div className="kv">
        <span>Your damage this month</span>
        <span>{mine}</span>
      </div>
      {status && (
        <div className="kv">
          <span>Hunters fighting</span>
          <span>{status.participants}</span>
        </div>
      )}
      <p className="hint">Every verified hard set deals 1 damage (up to 25 a day). HP grows with the number of hunters. Slay it before the month ends.</p>
      {!user ? (
        <p className="hint">Sign in to fight alongside other hunters. Until then this shows your own damage.</p>
      ) : !joined ? (
        <button
          className="btn btn-sm btn-red"
          onClick={() => {
            try {
              localStorage.setItem(BOSS_KEY, '1');
            } catch {
              /* storage blocked */
            }
            setJoined(true);
            toast('YOU JOINED THE HUNT');
          }}
        >
          JOIN THE HUNT
        </button>
      ) : (
        <p className="hint">Only your damage total is shared, never your logs.</p>
      )}
    </Collapsible>
  );
}

export function SystemLog({ ledger }: { ledger: Ledger }) {
  const events = ledger.events.slice(0, 12);
  if (!events.length) return null;
  return (
    <Collapsible id="log" title="SYSTEM LOG" icon="≣" summary={events[0]!.text}>
      {events.map((e, i) => (
        <div className="log-row" key={i}>
          <span className="log-date">{fmtDate(e.date, { month: 'short', day: 'numeric' })}</span>
          <span className={`log-text log-${e.kind}`}>{e.text}</span>
          {e.exp !== 0 && <span className={`log-exp${e.exp < 0 ? ' neg' : ''}`}>{e.exp > 0 ? `+${e.exp}` : e.exp}</span>}
        </div>
      ))}
    </Collapsible>
  );
}

export function SkillTreeCard() {
  const { logs, templates } = useApp();
  const skills = useMemo(() => getSkillState(logs, templates), [logs, templates]);
  const [tree, setTree] = useState(SKILL_TREES[0]!.id);
  const activeTree = SKILL_TREES.find((t) => t.id === tree)!;
  const unlocked = Object.values(skills.unlocked).filter(Boolean).length;
  return (
    <Collapsible id="skills" title="MASTERY TREES" icon="⌬" summary={`${unlocked} skill${unlocked === 1 ? '' : 's'} unlocked`}>
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
    </Collapsible>
  );
}

export function LoreCard({ level }: { level: number }) {
  const lore = loreUnlocked(level);
  return (
    <Collapsible id="lore" title="SYSTEM ARCHIVE" icon="✦" summary={`${lore.length} entr${lore.length === 1 ? 'y' : 'ies'}`}>
      {[...lore].reverse().map((l) => (
        <div key={l.level} style={{ marginBottom: 12 }}>
          <div className="label" style={{ color: 'var(--gold)' }}>
            LV {l.level} · {l.title.toUpperCase()}
          </div>
          <p className="prose">{l.text}</p>
        </div>
      ))}
    </Collapsible>
  );
}

export function RankLadder({ ledger }: { ledger: Ledger }) {
  return (
    <Collapsible id="ladder" title="RANK LADDER" icon="△" summary={`${ledger.rank}-Rank · LV ${ledger.level}`}>
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
    </Collapsible>
  );
}

