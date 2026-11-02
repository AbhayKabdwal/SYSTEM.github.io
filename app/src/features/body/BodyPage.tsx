import { useMemo, useState } from 'react';
import { bodyFatigue, logMuscleLoad, MUSCLES, muscleFatigue, muscleState, recoveryAdvice, type Muscle } from '../../domain';
import { useApp } from '../../state/store';
import { Card, Sec } from '../../ui/components';
import { fmtDate, useToday } from '../../ui/hooks';
import { BodyMap, fatigueColor, LEGEND } from './BodyMap';

const STATE_LABEL = { fresh: 'Fresh', worked: 'Worked', strained: 'Strained', overloaded: 'Overloaded' } as const;

export function BodyPage() {
  const logs = useApp((s) => s.logs);
  const templates = useApp((s) => s.templates);
  // Re-evaluate when the day changes; within a day the map moves slowly enough.
  const today = useToday();
  const fatigue = useMemo(() => muscleFatigue(logs, templates), [logs, templates, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState<Muscle | null>(null);
  const overall = bodyFatigue(fatigue);

  const recentForSelected = useMemo(() => {
    if (!selected) return [];
    return Object.keys(logs)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 14)
      .map((d) => ({ date: d, load: logMuscleLoad(logs[d]!, templates)[selected] ?? 0 }))
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
                <span>{r.load.toFixed(1)} units</span>
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
          Every logged set and quest task adds load to the muscles it works: primary movers take full load, helpers about half. Load fades with each
          muscle's recovery half-life (small muscles recover faster), and the percentage saturates so a single huge session tops out near 100%.
        </p>
        <p className="prose">Custom exercises are matched to muscles by name. You can set them exactly in the Training registry.</p>
      </Card>
    </div>
  );
}
