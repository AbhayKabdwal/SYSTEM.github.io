import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react';
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './state/store';
import { useSession } from './state/session';
import { cloudEnabled } from './cloud/client';
import { Notifications } from './ui/components';
import { useLedger, useQuestFor, useToday } from './ui/hooks';
import { useWidgetSync } from './native/widget';
import { addDays, flameFor, isUnlocked, monthDamage, monthOf, unlockFor, weekOf, type Feature, type Ledger } from './domain';
import { publishStats } from './cloud/social';
import { systemAlert, toast } from './ui/notify';
import { useUnlockNotices } from './ui/unlocks';
import { myDuels, reportBossDamage, reportDuelScore } from './cloud/competition';
import { duelPhase, duelScore } from './cloud/duelScore';
import { bossJoined } from './features/status/sections';
import { StatusPage } from './features/status/StatusPage';
import { QuestPage } from './features/daily/QuestPage';
import { MorePage } from './features/more/MorePage';
import { SetupPage } from './features/onboarding/SetupPage';
import { useReminderScheduler } from './native/useReminders';

/** Screens opened less often load on demand, so the app starts with just Status and Quest. */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

const ReportPage = page(() => import('./features/progress/ReportPage'), 'ReportPage');
const RecordsPage = page(() => import('./features/progress/RecordsPage'), 'RecordsPage');
const TimelinePage = page(() => import('./features/progress/TimelinePage'), 'TimelinePage');
const GuildPage = page(() => import('./features/social/Guilds'), 'GuildPage');
const BodyPage = page(() => import('./features/body/BodyPage'), 'BodyPage');
const HuntersPage = page(() => import('./features/social/HuntersPage'), 'HuntersPage');
const ProfilePage = page(() => import('./features/social/ProfilePage'), 'ProfilePage');
const PlanPage = page(() => import('./features/plan/PlanPage'), 'PlanPage');
const TrainingPage = page(() => import('./features/training/TrainingPage'), 'TrainingPage');
const AccountPage = page(() => import('./features/account/AccountPage'), 'AccountPage');
const VaultPage = page(() => import('./features/vault/VaultPage'), 'VaultPage');
const PrivacyPage = page(() => import('./features/privacy/PrivacyPage'), 'PrivacyPage');
const CalibratePage = page(() => import('./features/onboarding/CalibratePage'), 'CalibratePage');
const ArchivesPage = page(() => import('./features/archives/ArchivesPage'), 'ArchivesPage');
const ArchiveDetail = page(() => import('./features/archives/ArchivesPage'), 'ArchiveDetail');

const NAV: { to: string; icon: string; label: string; feature?: Feature }[] = [
  { to: '/', icon: '◈', label: 'STATUS' },
  { to: '/quest', icon: '⊕', label: 'QUEST' },
  { to: '/body', icon: '⚇', label: 'BODY', feature: 'body' },
  { to: '/hunters', icon: '♜', label: 'HUNTERS', feature: 'hunters' },
  { to: '/more', icon: '≡', label: 'MORE' },
];

function Header({ ledger }: { ledger: Ledger }) {
  const player = useApp((s) => s.player);
  const { user, sync, vault } = useSession();
  const flame = flameFor(ledger.streak);
  const syncColor = sync === 'error' ? 'var(--red)' : sync === 'syncing' ? 'var(--gold)' : 'var(--grn)';
  return (
    <header className="hdr">
      <Link to="/" className="logo">
        ◆ SYSTEM
      </Link>
      <Link to="/" className="streak-chip" style={{ color: flame.color }} aria-label={`${ledger.streak}-day streak`}>
        <span aria-hidden>🔥</span>
        {ledger.streak}
      </Link>
      <Link to="/" className="player-badge" aria-label={`${player?.name}, ${ledger.rank}-rank, level ${ledger.level}`}>
        <div className="player-info">
          <div className="player-name">
            {cloudEnabled && user && vault === 'unlocked' && <i className="sync-dot" style={{ background: syncColor }} title={`Sync: ${sync}`} />}
            {player?.name}
          </div>
          <div className="player-title" style={{ color: ledger.title.color }}>
            LVL {ledger.level} · {ledger.title.title}
          </div>
        </div>
        <div className="rank-icon" style={{ color: ledger.rankColor }}>
          {ledger.rank}
        </div>
      </Link>
    </header>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.querySelector('.scroll-area')?.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const NOTICE_KEY = 'sys:lastNotice';

/** The System greets you once a day with today's situation. */
function DailyNotice({ ledger }: { ledger: Ledger }) {
  const today = useToday();
  useEffect(() => {
    let last: string | null = null;
    try {
      last = localStorage.getItem(NOTICE_KEY);
      localStorage.setItem(NOTICE_KEY, today);
    } catch {
      /* storage blocked: show it every time */
    }
    if (last === today) return;
    const y = ledger.days[addDays(today, -1)]?.status;
    if (ledger.penaltyToday) {
      systemAlert(
        ledger.repairableStreak
          ? `YOU FAILED YESTERDAY'S QUEST\nENTERING THE PENALTY ZONE\nClear today's penalty quest with proof to restore your ${ledger.repairableStreak}-day streak.`
          : `YOU FAILED YESTERDAY'S QUEST\nENTERING THE PENALTY ZONE`,
      );
    } else if (last) {
      systemAlert(
        `[DAILY QUEST HAS ARRIVED]\n${y === 'verified' ? `Streak ${ledger.streak} · ×${ledger.nextMult.toFixed(2)} EXP today` : 'Clear it and attach proof to build your streak.'}`,
      );
    }
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * Keeps the server side of competition current while signed in: profile stats (if
 * shared), monthly boss damage (if you joined the hunt) and your duel scores.
 */
function CompetitionSync({ ledger }: { ledger: Ledger }) {
  const share = useApp((s) => s.player?.shareStats);
  const logs = useApp((s) => s.logs);
  const templates = useApp((s) => s.templates);
  const user = useSession((s) => s.user);
  const today = useToday();
  const sent = useRef<Record<string, string>>({});

  const once = (key: string, value: unknown, fn: () => Promise<unknown>) => {
    const v = JSON.stringify(value);
    if (sent.current[key] === v) return;
    fn()
      .then(() => (sent.current[key] = v))
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!cloudEnabled || !user) return;
    const t = setTimeout(() => {
      const stats = share
        ? {
            level: ledger.level,
            rank: ledger.rank,
            streak: ledger.streak,
            weekExp: ledger.weekExp,
            weekEp: ledger.weekEp,
            week: weekOf(today)[0]!,
            day: today,
            recentEp: ledger.recentEp,
            kept: ledger.recentKept.map((k) => (k ? '1' : '0')).join(''),
          }
        : null;
      once('stats', stats, () => publishStats(user.id, stats));
      if (bossJoined()) {
        const dmg = monthDamage(ledger, logs, templates, today);
        once('boss', [monthOf(today), dmg], () => reportBossDamage(user.id, monthOf(today), dmg));
      }
      void myDuels()
        .then((duels) => {
          for (const d of duels) {
            const phase = duelPhase(d, today);
            if (phase !== 'live' && phase !== 'settling') continue;
            const score = duelScore(ledger, d);
            once(`duel:${d.id}`, score, () => reportDuelScore(d.id, score));
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearTimeout(t);
  }, [share, user, ledger, logs, templates, today]);
  return null;
}

function Shell() {
  const ledger = useLedger();
  const ready = useApp((s) => s.ready);
  const today = useToday();
  const todayQuest = useQuestFor(today, ledger);
  const todayProgress = useApp((s) => s.logs[today]?.questProgress);
  useReminderScheduler(ledger, today);
  useUnlockNotices(ledger.level, ready);
  useWidgetSync(ledger, today, todayQuest, todayProgress);
  return (
    <div className={`app${ledger.penaltyToday ? ' penalty-mode' : ''}`}>
      <div className="grid-bg" />
      <div className="glow-bg" />
      <DailyNotice ledger={ledger} />
      <CompetitionSync ledger={ledger} />
      <Header ledger={ledger} />
      <main className="scroll-area">
        <ScrollToTop />
        <Suspense
          fallback={
            <p className="hint" style={{ textAlign: 'center', marginTop: 24 }}>
              Loading…
            </p>
          }
        >
          <Routes>
            <Route path="/" element={<StatusPage />} />
            <Route path="/quest" element={<QuestPage />} />
            <Route path="/body" element={<BodyPage />} />
            <Route path="/hunters" element={<HuntersPage />} />
            <Route path="/u/:handle" element={<ProfilePage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/archives" element={<ArchivesPage />} />
            <Route path="/archives/:date" element={<ArchiveDetail />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/vault" element={<VaultPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/calibrate" element={<CalibratePage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/guild/:id" element={<GuildPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <nav className="nav" aria-label="Main">
        {NAV.map((n) =>
          n.feature && !isUnlocked(n.feature, ledger.level) ? (
            <button
              key={n.to}
              className="nav-btn locked"
              aria-label={`${n.label}, unlocks at level ${unlockFor(n.feature).level}`}
              onClick={() => toast(`🔒 ${unlockFor(n.feature!).name.toUpperCase()} UNLOCKS AT LEVEL ${unlockFor(n.feature!).level}`)}
            >
              <span className="ni" aria-hidden>
                🔒
              </span>
              {n.label}
            </button>
          ) : (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
              <span className="ni" aria-hidden>
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          ),
        )}
      </nav>
    </div>
  );
}

/** Before a hunter exists: setup, or the account page to restore from sync. */
function Onboarding() {
  const { pathname } = useLocation();
  if (pathname === '/account' || pathname === '/privacy') {
    return (
      <div className="app">
        <div className="grid-bg" />
        <header className="hdr">
          <Link to="/" className="logo">
            ◆ SYSTEM
          </Link>
          <Link to="/" className="btn btn-sm">
            BACK
          </Link>
        </header>
        <main className="scroll-area">
          <Suspense fallback={null}>{pathname === '/account' ? <AccountPage /> : <PrivacyPage />}</Suspense>
        </main>
      </div>
    );
  }
  return (
    <div className="app">
      <div className="grid-bg" />
      <div className="glow-bg" />
      <SetupPage />
    </div>
  );
}

export default function App() {
  const { ready, player, init } = useApp();
  const start = useSession((s) => s.start);
  useEffect(() => {
    void init();
    start();
  }, [init, start]);

  return (
    <HashRouter>
      {!ready ? (
        <div className="splash">
          <div className="splash-title">◆ SYSTEM ◆</div>
          <div className="label" style={{ marginTop: 8, letterSpacing: 3 }}>
            INITIALIZING
          </div>
        </div>
      ) : player ? (
        <Shell />
      ) : (
        <Onboarding />
      )}
      <Notifications />
    </HashRouter>
  );
}
