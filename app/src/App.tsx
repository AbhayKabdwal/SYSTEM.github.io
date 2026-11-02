import { useEffect, useRef } from 'react';
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './state/store';
import { useSession } from './state/session';
import { cloudEnabled } from './cloud/client';
import { Notifications } from './ui/components';
import { useLedger, useToday } from './ui/hooks';
import { addDays, flameFor, weekOf, type Ledger } from './domain';
import { publishStats } from './cloud/social';
import { systemAlert } from './ui/notify';
import { StatusPage } from './features/status/StatusPage';
import { QuestPage } from './features/daily/QuestPage';
import { BodyPage } from './features/body/BodyPage';
import { HuntersPage } from './features/social/HuntersPage';
import { ProfilePage } from './features/social/ProfilePage';
import { MorePage } from './features/more/MorePage';
import { PlanPage } from './features/plan/PlanPage';
import { TrainingPage } from './features/training/TrainingPage';
import { ArchiveDetail, ArchivesPage } from './features/archives/ArchivesPage';
import { AccountPage } from './features/account/AccountPage';
import { VaultPage } from './features/vault/VaultPage';
import { PrivacyPage } from './features/privacy/PrivacyPage';
import { SetupPage } from './features/onboarding/SetupPage';
import { CalibratePage } from './features/onboarding/CalibratePage';

const NAV = [
  { to: '/', icon: '◈', label: 'STATUS' },
  { to: '/quest', icon: '⊕', label: 'QUEST' },
  { to: '/body', icon: '⚇', label: 'BODY' },
  { to: '/hunters', icon: '♜', label: 'HUNTERS' },
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
      systemAlert(`[DAILY QUEST HAS ARRIVED]\n${y === 'verified' ? `Streak ${ledger.streak} · ×${ledger.nextMult.toFixed(2)} EXP today` : 'Clear it and attach proof to build your streak.'}`);
    }
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Keeps leaderboard stats current while "Share stats" is on. */
function StatsPublisher({ ledger }: { ledger: Ledger }) {
  const share = useApp((s) => s.player?.shareStats);
  const user = useSession((s) => s.user);
  const today = useToday();
  const sent = useRef('');
  useEffect(() => {
    if (!cloudEnabled || !user) return;
    const stats = share ? { level: ledger.level, rank: ledger.rank, streak: ledger.streak, weekExp: ledger.weekExp, week: weekOf(today)[0]! } : null;
    const key = JSON.stringify(stats);
    if (key === sent.current) return;
    const t = setTimeout(() => {
      publishStats(user.id, stats)
        .then(() => (sent.current = key))
        .catch(() => undefined);
    }, 3000);
    return () => clearTimeout(t);
  }, [share, user, ledger.level, ledger.rank, ledger.streak, ledger.weekExp, today]);
  return null;
}

function Shell() {
  const ledger = useLedger();
  return (
    <div className={`app${ledger.penaltyToday ? ' penalty-mode' : ''}`}>
      <div className="grid-bg" />
      <div className="glow-bg" />
      <DailyNotice ledger={ledger} />
      <StatsPublisher ledger={ledger} />
      <Header ledger={ledger} />
      <main className="scroll-area">
        <ScrollToTop />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="nav" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
            <span className="ni" aria-hidden>
              {n.icon}
            </span>
            {n.label}
          </NavLink>
        ))}
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
        <main className="scroll-area">{pathname === '/account' ? <AccountPage /> : <PrivacyPage />}</main>
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
