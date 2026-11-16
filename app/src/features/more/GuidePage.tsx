import { Link } from 'react-router-dom';
import { BASICS, UNLOCKS } from '../../domain';
import { Card, Sec } from '../../ui/components';
import { Collapsible } from '../../ui/Collapsible';
import { featurePath } from '../../ui/FeatureGuide';
import { useLedger } from '../../ui/hooks';

/** Every feature explained: the basics, what's unlocked, and what's coming. */
export function GuidePage() {
  const { level } = useLedger();
  return (
    <div className="page">
      <Card>
        <Sec>THE BASICS</Sec>
        {BASICS.map((b) => (
          <div key={b.name} style={{ marginBottom: 14 }}>
            <div className="guide-name" style={{ fontSize: 13 }}>
              {b.icon} {b.name}
            </div>
            <ul className="guide-list">
              {b.guide.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
      {UNLOCKS.map((u) => {
        const open = level >= u.level;
        const p = featurePath(u.to);
        return open ? (
          <Collapsible key={u.feature} id={`guide-${u.feature}`} title={u.name.toUpperCase()} icon={u.icon} summary={u.blurb}>
            <ul className="guide-list">
              {u.guide.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <Link className="btn btn-sm" style={{ marginTop: 12, width: '100%' }} to={p.pathname} state={p.state}>
              OPEN {u.name.toUpperCase()}
            </Link>
          </Collapsible>
        ) : (
          <div key={u.feature} className="card locked-row">
            <span aria-hidden>🔒</span>
            <span style={{ flex: 1 }}>{u.name}</span>
            <span className="hint" style={{ margin: 0 }}>
              Level {u.level}
            </span>
          </div>
        );
      })}
    </div>
  );
}
