import { Link } from 'react-router-dom';
import { cloudEnabled } from '../../cloud/client';
import { useSession } from '../../state/session';
import { Card } from '../../ui/components';

const ITEMS = [
  { to: '/plan', icon: '◇', title: 'Plan', sub: 'This week and upcoming gates' },
  { to: '/training', icon: '⊞', title: 'Training', sub: 'Training types, exercises, quest pool' },
  { to: '/archives', icon: '≡', title: 'Archives', sub: 'Every logged day' },
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
      <Card>
        <p className="hint">SYSTEM v{__APP_VERSION__} · a fan-made training tracker.</p>
      </Card>
    </div>
  );
}
