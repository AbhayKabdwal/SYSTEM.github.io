import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { unlockFor, type Feature } from '../domain';
import { Dialog } from './components';

/** Feature guides waiting to be shown, one at a time. */
export const useGuides = create<{ queue: Feature[] }>(() => ({ queue: [] }));

export const showGuides = (features: Feature[]) => useGuides.setState((s) => ({ queue: [...s.queue, ...features.filter((f) => !s.queue.includes(f))] }));

const next = () => useGuides.setState((s) => ({ queue: s.queue.slice(1) }));

/** Where a feature lives: a route, or a section of the Status page to open. */
export function featurePath(to: string): { pathname: string; state?: { open: string } } {
  return to.startsWith('/') ? { pathname: to } : { pathname: '/', state: { open: to } };
}

/** "NEW FEATURE UNLOCKED": what it is, how to use it, and a button to go there. */
export function FeatureGuideDialog() {
  const feature = useGuides((s) => s.queue[0]);
  const navigate = useNavigate();
  if (!feature) return null;
  const u = unlockFor(feature);
  const left = useGuides.getState().queue.length - 1;
  return (
    <Dialog title="NEW FEATURE UNLOCKED" onClose={next}>
      <div className="guide-head">
        <span className="guide-icon" aria-hidden>
          {u.icon}
        </span>
        <div>
          <div className="guide-name">{u.name}</div>
          <div className="hint" style={{ marginTop: 2 }}>
            Unlocked at level {u.level}
          </div>
        </div>
      </div>
      <ul className="guide-list">
        {u.guide.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={next}>
          {left ? `NEXT (${left})` : 'LATER'}
        </button>
        <button
          className="btn btn-grn"
          onClick={() => {
            const p = featurePath(u.to);
            useGuides.setState({ queue: [] });
            navigate(p.pathname, { state: p.state });
          }}
        >
          SHOW ME
        </button>
      </div>
    </Dialog>
  );
}
