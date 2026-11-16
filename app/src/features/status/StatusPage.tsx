import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { bodyFatigue, EXP, flameFor, getMonthly, isComplete, isUnlocked, muscleFatigue, recoveryAdvice, UNLOCKS, type Ledger } from '../../domain';
import { useApp } from '../../state/store';
import { Bar, Card, Sec } from '../../ui/components';
import { Collapsible, OpenSection } from '../../ui/Collapsible';
import { useLedger, useQuestFor, useToday } from '../../ui/hooks';
import { fatigueColor } from '../body/BodyMap';
import { AvatarPicker } from './AvatarPicker';
import { DAY_MARK } from './marks';
import {
  ArmyCard,
  BossCard,
  InventoryCard,
  LoreCard,
  RankLadder,
  ReportCard,
  SideQuestCards,
  SkillTreeCard,
  StatsCard,
  StreakCard,
  SystemLog,
} from './sections';

export { DAY_MARK };

/**
 * Four things up top (who you are, your streak, today's quest, what to do next);
 * everything else is a one-line row that opens on tap and appears only once unlocked.
 */
export function StatusPage() {
  const { player, logs, templates } = useApp();
  const today = useToday();
  const ledger = useLedger();
  const level = ledger.level;
  const muscles = useMemo(() => muscleFatigue(logs, templates, new Date(), ledger.tier), [logs, templates, ledger.tier, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const body = bodyFatigue(muscles);
  const monthly = getMonthly(logs, today);
  const openSection = (useLocation().state as { open?: string } | null)?.open ?? null;

  return (
    <OpenSection.Provider value={openSection}>
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

        {player?.test && (
        <div className="sample-banner">
          TEST HUNTER · sync and sharing are paused
          <Link to="/vault" className="link-btn">
            restore my hunter
          </Link>
        </div>
      )}

      <StatusWindow ledger={ledger} name={player?.name ?? ''} />

        {ledger.penaltyToday && <PenaltyCard ledger={ledger} today={today} />}

        <TodayCard ledger={ledger} today={today} />

        <StreakCard ledger={ledger} today={today} />

        {player?.prefs && <SideQuestCards ledger={ledger} today={today} />}

        {isUnlocked('stats', level) && <StatsCard ledger={ledger} body={body} />}

        {isUnlocked('reports', level) && <ReportCard ledger={ledger} today={today} />}

        {isUnlocked('items', level) && <InventoryCard ledger={ledger} today={today} />}

        {isUnlocked('shadows', level) && <ArmyCard ledger={ledger} />}

        {isUnlocked('boss', level) && <BossCard ledger={ledger} today={today} />}

        {isUnlocked('body', level) && (
          <Collapsible id="condition" title="CONDITION" icon="⚇" summary={`Body load ${body}%`}>
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
          </Collapsible>
        )}

        <SystemLog ledger={ledger} />

        {isUnlocked('skills', level) && <SkillTreeCard />}

        <Collapsible id="monthly" title="30-DAY CHALLENGE" icon="◇" summary={`${monthly.done}/${monthly.target}`}>
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
        </Collapsible>

        <LoreCard level={level} />

        <RankLadder ledger={ledger} />

        <NextUnlock level={level} />
      </div>
    </OpenSection.Provider>
  );
}

function StatusWindow({ ledger, name }: { ledger: Ledger; name: string }) {
  return (
    <Card className="status-window">
      <div className="rank-card">
        <AvatarPicker rank={ledger.rank} color={ledger.rankColor} />
        <div className="rank-detail">
          <div className="rank-name">{name}</div>
          <div className="rank-sub" style={{ color: ledger.title.color }}>
            LVL {ledger.level} — {ledger.title.title}
          </div>
          <div className="xp-labels">
            <span>EXP</span>
            <span>
              {ledger.levelNext ? `${(ledger.exp - ledger.levelStart).toLocaleString()} / ${(ledger.levelNext - ledger.levelStart).toLocaleString()}` : 'MAX'}
            </span>
          </div>
          <Bar pct={ledger.levelProg} color={ledger.rankColor} />
          {ledger.statPoints.free > 0 && isUnlocked('stats', ledger.level) && (
            <div className="hint" style={{ marginTop: 4, color: 'var(--gold)' }}>
              {ledger.statPoints.free} stat point{ledger.statPoints.free === 1 ? '' : 's'} to spend: open STATS below
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function PenaltyCard({ ledger, today }: { ledger: Ledger; today: string }) {
  const todayStatus = ledger.days[today]?.status;
  return (
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
  );
}

function TodayCard({ ledger, today }: { ledger: Ledger; today: string }) {
  const logs = useApp((s) => s.logs);
  const quest = useQuestFor(today, ledger);
  const todayLog = logs[today];
  const status = ledger.days[today]?.status ?? 'open';
  const flame = flameFor(ledger.streak);
  const action =
    status === 'unverified'
      ? 'ATTACH PROOF'
      : isComplete(todayLog)
        ? 'OPEN QUEST'
        : todayLog?.questProgress && Object.keys(todayLog.questProgress).length
          ? 'CONTINUE QUEST'
          : "BEGIN TODAY'S QUEST";
  return (
    <Card>
      <Sec>{ledger.penaltyToday ? 'MANDATORY CLEAR' : "TODAY'S QUEST"}</Sec>
      <div className="label" style={{ color: DAY_MARK[status].color }}>
        {status === 'verified'
          ? '✓ QUEST COMPLETE · PROOF ATTACHED'
          : status === 'unverified'
            ? '◐ CLEARED · ATTACH PROOF FOR FULL EXP'
            : status === 'rest'
              ? '☾ REST DAY'
              : quest.name}
      </div>
      {status !== 'rest' &&
        quest.tasks.map((t) => {
          const v = Number(todayLog?.questProgress?.[t.id] ?? 0);
          return (
            <div className="kv" key={t.id}>
              <span style={{ color: v >= t.target ? 'var(--grn)' : undefined }}>{t.label}</span>
              <span>
                {todayLog ? `${v} / ` : ''}
                {t.target} {t.unit}
              </span>
            </div>
          );
        })}
      {status !== 'verified' && status !== 'rest' ? (
        <Link className="btn btn-grn next-action" to="/quest" style={{ marginTop: 12 }}>
          {action} ▸
        </Link>
      ) : (
        <p className="hint" style={{ marginTop: 8 }}>
          {status === 'verified' ? `Earned +${ledger.days[today]?.total ?? 0} EXP and ${ledger.days[today]?.ep ?? 0} EP today. ` : ''}
          <span style={{ color: flame.color }}>
            🔥 {ledger.streak}-day streak. Come back tomorrow for ×{ledger.nextMult.toFixed(2)} EXP.
          </span>
        </p>
      )}
    </Card>
  );
}

/** What the next level brings, so there's always something to reach for. */
function NextUnlock({ level }: { level: number }) {
  const next = UNLOCKS.find((u) => u.level > level);
  if (!next) return null;
  return (
    <Link to="/guide" className="lock-note" style={{ display: 'block', textDecoration: 'none' }}>
      🔒 LEVEL {next.level}: {next.name.toUpperCase()} · SEE THE GUIDE
    </Link>
  );
}
