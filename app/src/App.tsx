import { useEffect } from 'react';
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './state/store';
import { useSession } from './state/session';
import { cloudEnabled } from './cloud/client';
import { Notifications } from './ui/components';
import { usePenalty, useRankInfo } from './ui/hooks';
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

const NAV = [
  { to: '/', icon: '◈', label: 'STATUS' },
  { to: '/quest', icon: '⊕', label: 'QUEST' },
  { to: '/body', icon: '⚇', label: 'BODY' },
  { to: '/hunters', icon: '♜', label: 'HUNTERS' },
  { to: '/more', icon: '≡', label: 'MORE' },
];

function Header() {
  const player = useApp((s) => s.player);
  const { rank } = useRankInfo();
  const { user, sync, vault } = useSession();
  const syncColor = sync === 'error' ? 'var(--red)' : sync === 'syncing' ? 'var(--gold)' : 'var(--grn)';
  return (
    <header className="hdr">
      <Link to="/" className="logo">
        ◆ SYSTEM
      </Link>
      <Link to="/" className="player-badge" aria-label={`${player?.name}, rank ${rank.rank}`}>
        <div className="player-info">
          <div className="player-name">
            {cloudEnabled && user && vault === 'unlocked' && <i className="sync-dot" style={{ background: syncColor }} title={`Sync: ${sync}`} />}
            {player?.name}
          </div>
          <div className="player-title" style={{ color: rank.color }}>
            LVL {rank.level} · {rank.title}
          </div>
        </div>
        <div className="rank-icon" style={{ color: rank.color }}>
          {rank.rank}
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

function Shell() {
  const penalty = usePenalty();
  return (
    <div className={`app${penalty ? ' penalty-mode' : ''}`}>
      <div className="grid-bg" />
      <div className="glow-bg" />
      <Header />
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
