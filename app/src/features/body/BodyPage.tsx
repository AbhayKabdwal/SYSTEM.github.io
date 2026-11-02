import { useMemo, useState } from 'react';
import { bodyFatigue, logMuscleLoad, muscleCapacity, MUSCLES, muscleFatigue, muscleState, recoveryAdvice, type Muscle } from '../../domain';
import { useApp } from '../../state/store';
import { Card, Sec } from '../../ui/components';
import { fmtDate, useLedger, useToday } from '../../ui/hooks';
import { ANATOMY_CREDIT, BodyMap, fatigueColor, LEGEND } from './BodyMap';

const STATE_LABEL = { fresh: 'Fresh', worked: 'Worked', strained: 'Strained', overloaded: 'Overloaded' } as const;

export function BodyPage() {
  const logs = useApp((s) => s.logs);
  const templates = useApp((s) => s.templates);
  // Re-evaluate when the day changes; within a day the map moves slowly enough.
  const today = useToday();
  const { tier } = useLedger();
  const fatigue = useMemo(() => muscleFatigue(logs, templates, new Date(), tier), [logs, templates, today, tier]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState<Muscle | null>(null);
  const overall = bodyFatigue(fatigue);

  const recentForSelected = useMemo(() => {
    if (!selected) return [];
    return Object.keys(logs)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 14)
      .map((d) => ({ date: d, load: logMuscleLoad(logs, templates, d)[selected] ?? 0 }))
      .filter((x) => x.load > 0)
      .slice(0, 5);
  }, [selected, logs, templates]);

  const sorted = [...MUSCLES].sort((a, b) => fatigue[b.id] - fatigue[a.id]);

  return (
    <div className="page">
      <Card>
        <Sec>MUSCLE LOAD</Sec>
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="prose">{recoveryAdvice(fatigue)}</span>
          <span style={{ fontFamily: 'var(--hd)', fontSize: 18, color: fatigueColor(Math.max(overall, 30)) }}>{overall}%</span>
        </div>
        <BodyMap fatigue={fatigue} selected={selected} onSelect={(m) => setSelected((cur) => (cur === m ? null : m))} />
        <div className="legend">
          {LEGEND.map((l) => (
            <span key={l.label}>
              <i style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>
          Tap a muscle for details.
        </p>
      </Card>

      {selected && (
        <Card>
          <Sec>{MUSCLES.find((m) => m.id === selected)!.label.toUpperCase()}</Sec>
          <div className="kv">
            <span>Fatigue</span>
            <span>
              {fatigue[selected]}% · {STATE_LABEL[muscleState(fatigue[selected])]}
            </span>
          </div>
          <div className="kv">
            <span>Recovery half-life</span>
            <span>{MUSCLES.find((m) => m.id === selected)!.halfLife} h</span>
          </div>
          {recentForSelected.length ? (
            recentForSelected.map((r) => (
              <div className="kv" key={r.date}>
                <span>{fmtDate(r.date)}</span>
                <span>{r.load.toFixed(1)} hard sets</span>
              </div>
            ))
          ) : (
            <p className="prose muted" style={{ marginTop: 8 }}>
              Not trained in the last two weeks.
            </p>
          )}
        </Card>
      )}

      <Card>
        <Sec>ALL MUSCLES</Sec>
        {sorted.map((m) => (
          <button key={m.id} className={`muscle-row${selected === m.id ? ' selected' : ''}`} onClick={() => setSelected(m.id)}>
            <span>{m.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${fatigue[m.id]}%`, background: fatigueColor(Math.max(fatigue[m.id], 30)) }} />
            </div>
            <span>{fatigue[m.id]}%</span>
          </button>
        ))}
      </Card>

      <Card>
        <Sec>HOW THIS WORKS</Sec>
        <p className="prose">
          Load is counted in hard sets: sets taken close to failure. Quest totals are converted using a typical hard set for each exercise (about 15
          push-ups, 25 squats, 45 s of plank). Gym sets are compared with your own recent bests, so 8 reps at 80% of your best counts as a hard set
          and 8 reps at 50% counts for much less. Add an RPE to a set to say exactly how hard it was.
        </p>
        <p className="prose">
          Primary movers take the full set, helpers about half. Fatigue fades with each muscle's recovery half-life: about 30 h for legs and lower
          back, 26 h for chest and lats, 16–20 h for arms, calves and abs. Around {Math.round(muscleCapacity(tier))} hard sets in a day reads as about
          63%, and the scale saturates so nothing passes 100%. Higher ranks tolerate slightly more.
        </p>
        <p className="prose">Custom exercises are matched to muscles by name. You can set them exactly in the Training registry.</p>
        <p className="credit">
          <a href={ANATOMY_CREDIT.url} target="_blank" rel="noreferrer noopener">
            {ANATOMY_CREDIT.text}
          </a>
        </p>
      </Card>
    </div>
  );
}
