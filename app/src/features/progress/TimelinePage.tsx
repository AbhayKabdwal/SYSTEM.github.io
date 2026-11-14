import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../state/store';
import { Card, Sec } from '../../ui/components';
import { fmtDate, usePhotoUrl } from '../../ui/hooks';

interface Shot {
  id: string;
  date: string;
  label: string;
}

/** Every progress and proof photo by date; pick two to compare side by side. */
export function TimelinePage() {
  const logs = useApp((s) => s.logs);
  const shots = useMemo(() => {
    const out: Shot[] = [];
    for (const [date, log] of Object.entries(logs)) {
      (log.photoIds ?? []).forEach((id, i) => id && out.push({ id, date, label: ['Front', 'Side', 'Back'][i] ?? 'Photo' }));
      if (log.proof?.photoId) out.push({ id: log.proof.photoId, date, label: 'Proof' });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);
  const [picked, setPicked] = useState<string[]>([]);
  const pick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
  const [a, b] = picked.map((id) => shots.find((s) => s.id === id)!).sort((x, y) => x.date.localeCompare(y.date));

  return (
    <div className="page">
      {a && b && (
        <Card>
          <Sec>COMPARE</Sec>
          <div className="compare">
            <Shot shot={a} />
            <Shot shot={b} />
          </div>
        </Card>
      )}
      <Card>
        <Sec>BODY TIMELINE</Sec>
        {!shots.length ? (
          <p className="prose muted">
            Progress photos and proof photos appear here. Add them on the <Link to="/quest">Quest</Link> page.
          </p>
        ) : (
          <>
            <p className="hint" style={{ marginTop: -4 }}>
              Tap two photos to compare them.
            </p>
            <div className="timeline">
              {shots.map((s) => (
                <button key={s.id} className={picked.includes(s.id) ? 'picked' : ''} onClick={() => pick(s.id)} aria-pressed={picked.includes(s.id)}>
                  <Thumb id={s.id} />
                  <div className="hint" style={{ padding: '2px 0' }}>
                    {fmtDate(s.date, { month: 'short', day: 'numeric' })} · {s.label}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Thumb({ id }: { id: string }) {
  const url = usePhotoUrl(id);
  return url ? <img src={url} alt="" loading="lazy" /> : <div style={{ aspectRatio: '3 / 4', background: 'var(--bg2)' }} />;
}

function Shot({ shot }: { shot: Shot }) {
  const url = usePhotoUrl(shot.id);
  return (
    <figure>
      {url && <img src={url} alt={`${shot.label} photo, ${shot.date}`} />}
      <figcaption className="hint" style={{ textAlign: 'center' }}>
        {fmtDate(shot.date)} · {shot.label}
      </figcaption>
    </figure>
  );
}
