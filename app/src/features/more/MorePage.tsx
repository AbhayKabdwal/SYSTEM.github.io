import { useState } from 'react';
import { Link } from 'react-router-dom';
import { devMode, setDevMode } from '../../ui/devMode';
import { toast } from '../../ui/notify';
import { play, setSoundOn, soundOn } from '../../ui/sound';
import { cloudEnabled } from '../../cloud/client';
import { useSession } from '../../state/session';
import { Card } from '../../ui/components';
import { isNative } from '../../native/platform';
import { RemindersCard } from './RemindersCard';

const ITEMS = [
  { to: '/guide', icon: '?', title: 'Guide', sub: 'Every feature explained, and what unlocks next' },
  { to: '/plan', icon: '◇', title: 'Plan', sub: 'This week and upcoming gates' },
  { to: '/training', icon: '⊞', title: 'Training', sub: 'Training types, exercises, quest pool' },
  { to: '/archives', icon: '≡', title: 'Archives', sub: 'Every logged day' },
  { to: '/records', icon: '★', title: 'Personal Records', sub: 'Best sets, holds and lifts' },
  { to: '/report', icon: '▤', title: 'Weekly Report', sub: 'The System grades your week' },
  { to: '/timeline', icon: '◫', title: 'Body Timeline', sub: 'Progress photos over time, side by side' },
  { to: '/account', icon: '⚿', title: 'Account & Sync', sub: 'Sign in, encrypted vault, profile' },
  { to: '/vault', icon: '⇄', title: 'Data Vault', sub: 'Settings, backup, device storage' },
  { to: '/privacy', icon: '◎', title: 'Privacy', sub: 'What is stored where' },
];

export function MorePage() {
  const { user, vault } = useSession();
  return (
    <div className="page">
      {ITEMS.map((i) => (
        <Link key={i.to} to={i.to} className="list-item">
          <span style={{ fontSize: 20, width: 24, textAlign: 'center', color: 'var(--glow)' }} aria-hidden>
            {i.icon}
          </span>
          <div style={{ flex: 1 }}>
            <div className="list-title">{i.title}</div>
            <div className="list-sub">
              {i.to === '/account' && cloudEnabled ? (user ? (vault === 'unlocked' ? 'Signed in · syncing' : 'Signed in · vault locked') : 'Signed out') : i.sub}
            </div>
          </div>
          <span className="muted" aria-hidden>
            ›
          </span>
        </Link>
      ))}
      {isNative && <RemindersCard />}
      <SoundToggle />
      <Card>
        <VersionTapper />
      </Card>
    </div>
  );
}

/** Tap the version seven times to turn on developer mode (test hunters in Data Vault). */
function VersionTapper() {
  const [taps, setTaps] = useState(0);
  return (
    <button
      className="quiet-link"
      onClick={() => {
        const n = taps + 1;
        setTaps(n);
        if (devMode()) return toast('DEVELOPER MODE IS ON · SEE DATA VAULT');
        if (n >= 7) {
          setDevMode(true);
          toast('DEVELOPER MODE ON · TEST HUNTERS IN DATA VAULT');
        } else if (n >= 4) toast(`${7 - n} more taps for developer mode`);
      }}
    >
      SYSTEM v{__APP_VERSION__} · a fan-made training tracker
    </button>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(soundOn);
  return (
    <Card>
      <label className="check">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setSoundOn(e.target.checked);
            setOn(e.target.checked);
            if (e.target.checked) play('chime');
          }}
        />
        <span>
          <span className="list-title">Sound effects</span>
          <span className="hint" style={{ display: 'block', marginTop: 2 }}>
            A short System chime with notifications, level-ups and rank-ups.
          </span>
        </span>
      </label>
    </Card>
  );
}
