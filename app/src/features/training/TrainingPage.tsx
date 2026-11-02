import { useState } from 'react';
import { guessMuscles, MUSCLES, musclesFor, type Exercise, type Muscle, type MuscleWeights, type QuestTask, type Template } from '../../domain';
import { useApp } from '../../state/store';
import { uid } from '../../data/repo';
import { Card, Dialog, ErrorText, Sec } from '../../ui/components';
import { toast } from '../../ui/notify';

const EX_UNITS = [
  { value: 'kg', label: 'Weight × reps' },
  { value: 'reps', label: 'Reps' },
  { value: 'sec', label: 'Seconds' },
  { value: 'min', label: 'Minutes' },
  { value: 'km', label: 'Kilometres' },
  { value: 'stage', label: 'Skill stage' },
];
const QUEST_UNITS = ['reps', 'sec', 'min', 'km'];
const COLORS = ['#ff4455', '#4488ff', '#44ffaa', '#aa44ff', '#ffaa44', '#ffdd44', '#00c8ff', '#ffd700', '#ff66cc'];
const MIN_POOL = 3;

export function TrainingPage() {
  const { templates, questPool, logs, setTemplates, setQuestPool } = useApp();
  const [editing, setEditing] = useState<Template | null>(null);
  const [poolOpen, setPoolOpen] = useState(false);

  const usedBy = (id: string) => Object.values(logs).filter((l) => l.templateId === id).length;

  return (
    <div className="page">
      <Card>
        <Sec>TRAINING REGISTRY</Sec>
        {templates.map((t) => (
          <button key={t.id} className="list-item" onClick={() => setEditing(t)}>
            <span className="dot" style={{ background: t.color }} />
            <div style={{ flex: 1 }}>
              <div className="list-title">{t.name}</div>
              <div className="list-sub">{t.exercises.map((e) => e.name).join(' · ') || 'No exercises yet'}</div>
            </div>
            <span className="muted" aria-hidden>
              ›
            </span>
          </button>
        ))}
        <button className="btn" style={{ marginTop: 6 }} onClick={() => setEditing({ id: uid(), name: '', color: COLORS[6]!, exercises: [] })}>
          + NEW TRAINING TYPE
        </button>
      </Card>

      <Card>
        <Sec>DAILY QUEST POOL</Sec>
        <p className="hint" style={{ marginTop: -4, marginBottom: 8 }}>
          Each day's random gate draws 3 tasks from this pool.
        </p>
        {questPool.map((q) => (
          <div key={q.id} className="kv">
            <span>{q.label}</span>
            <span>
              {q.target} {q.unit}
            </span>
          </div>
        ))}
        <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setPoolOpen(true)}>
          EDIT POOL
        </button>
      </Card>

      {editing && (
        <TemplateEditor
          initial={editing}
          isNew={!templates.some((t) => t.id === editing.id)}
          usedBy={usedBy(editing.id)}
          onClose={() => setEditing(null)}
          onSave={async (t) => {
            const exists = templates.some((x) => x.id === t.id);
            await setTemplates(exists ? templates.map((x) => (x.id === t.id ? t : x)) : [...templates, t]);
            toast('SAVED');
            setEditing(null);
          }}
          onDelete={async () => {
            await setTemplates(templates.filter((x) => x.id !== editing.id));
            toast('DELETED');
            setEditing(null);
          }}
        />
      )}

      {poolOpen && (
        <PoolEditor
          initial={questPool}
          onClose={() => setPoolOpen(false)}
          onSave={async (p) => {
            await setQuestPool(p);
            toast('QUEST POOL SAVED');
            setPoolOpen(false);
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  initial,
  isNew,
  usedBy,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Template;
  isNew: boolean;
  usedBy: number;
  onClose: () => void;
  onSave: (t: Template) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [t, setT] = useState<Template>(structuredClone(initial));
  const [musclesFor_, setMusclesFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setEx = (id: string, patch: Partial<Exercise>) => setT((x) => ({ ...x, exercises: x.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const move = (i: number, d: -1 | 1) =>
    setT((x) => {
      const ex = [...x.exercises];
      const j = i + d;
      if (j < 0 || j >= ex.length) return x;
      [ex[i], ex[j]] = [ex[j]!, ex[i]!];
      return { ...x, exercises: ex };
    });

  const save = () => {
    const name = t.name.trim().toUpperCase();
    if (!name) return setError('Give it a name.');
    if (t.exercises.some((e) => !e.name.trim())) return setError('Every exercise needs a name.');
    void onSave({ ...t, name, exercises: t.exercises.map((e) => ({ ...e, name: e.name.trim() })) });
  };

  const muscleEx = t.exercises.find((e) => e.id === musclesFor_);

  return (
    <Dialog title={isNew ? 'NEW TRAINING TYPE' : 'EDIT TRAINING TYPE'} onClose={onClose}>
      <div className="field">
        <label className="label" htmlFor="tpl-name">
          NAME
        </label>
        <input id="tpl-name" className="inp name-inp" maxLength={30} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="PUSH DAY" />
      </div>
      <div className="field">
        <span className="label">COLOUR</span>
        <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Colour ${c}`}
              aria-pressed={t.color === c}
              onClick={() => setT({ ...t, color: c })}
              style={{ width: 28, height: 28, borderRadius: 4, background: c, border: t.color === c ? '2px solid var(--bright)' : '2px solid transparent', cursor: 'pointer' }}
            />
          ))}
        </div>
      </div>

      <span className="label">EXERCISES</span>
      {t.exercises.map((ex, i) => {
        const m = musclesFor(ex);
        return (
          <div key={ex.id} className="ex-card" style={{ padding: 10 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <input className="inp" aria-label={`Exercise ${i + 1} name`} value={ex.name} maxLength={40} placeholder="Exercise name" onChange={(e) => setEx(ex.id, { name: e.target.value })} />
              <button className="remove-btn" aria-label={`Remove ${ex.name || 'exercise'}`} onClick={() => setT({ ...t, exercises: t.exercises.filter((x) => x.id !== ex.id) })}>
                ×
              </button>
            </div>
            <div className="row">
              <select className="sel" aria-label={`${ex.name} unit`} value={String(ex.unit)} onChange={(e) => setEx(ex.id, { unit: e.target.value })}>
                {EX_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              <button className="icon-btn" aria-label="Move up" onClick={() => move(i, -1)}>
                ↑
              </button>
              <button className="icon-btn" aria-label="Move down" onClick={() => move(i, 1)}>
                ↓
              </button>
            </div>
            <button className="link-btn" onClick={() => setMusclesFor(ex.id)}>
              Muscles: {Object.keys(m).length ? Object.keys(m).map((k) => MUSCLES.find((x) => x.id === k)?.label).join(', ') : 'none detected, tap to set'}
              {ex.muscles ? ' (custom)' : ''}
            </button>
          </div>
        );
      })}
      <button className="btn btn-sm" onClick={() => setT({ ...t, exercises: [...t.exercises, { id: uid(), name: '', unit: 'reps' }] })}>
        + ADD EXERCISE
      </button>

      <ErrorText error={error} />
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onClose}>
          CANCEL
        </button>
        <button className="btn btn-grn" onClick={save}>
          SAVE
        </button>
      </div>
      {!isNew && (
        <button
          className="btn btn-red"
          style={{ marginTop: 8 }}
          onClick={() => {
            const msg = usedBy
              ? `Delete ${initial.name}? ${usedBy} logged day(s) use it; their sets stay stored but won't show until you recreate it.`
              : `Delete ${initial.name}?`;
            if (confirm(msg)) void onDelete();
          }}
        >
          DELETE TYPE
        </button>
      )}

      {muscleEx && (
        <MuscleEditor
          exercise={muscleEx}
          onClose={() => setMusclesFor(null)}
          onSave={(w) => {
            setEx(muscleEx.id, { muscles: w });
            setMusclesFor(null);
          }}
        />
      )}
    </Dialog>
  );
}

const WEIGHT_STEPS = [0, 0.5, 1];
const WEIGHT_LABEL: Record<number, string> = { 0: '—', 0.5: 'Helper', 1: 'Primary' };

function MuscleEditor({ exercise, onClose, onSave }: { exercise: Exercise; onClose: () => void; onSave: (w: MuscleWeights | undefined) => void }) {
  const [w, setW] = useState<MuscleWeights>(() => ({ ...musclesFor(exercise) }));
  const snap = (v: number | undefined) => (v === undefined ? 0 : v >= 0.75 ? 1 : v >= 0.25 ? 0.5 : 0);
  const cycle = (m: Muscle) =>
    setW((cur) => {
      const next = WEIGHT_STEPS[(WEIGHT_STEPS.indexOf(snap(cur[m])) + 1) % WEIGHT_STEPS.length]!;
      const out = { ...cur };
      if (next) out[m] = next;
      else delete out[m];
      return out;
    });
  return (
    <Dialog title={`MUSCLES · ${exercise.name.toUpperCase() || 'EXERCISE'}`} onClose={onClose}>
      <p className="hint" style={{ marginBottom: 10 }}>
        Tap to cycle: — → Helper → Primary. These drive the muscle map.
      </p>
      {MUSCLES.map((m) => (
        <button key={m.id} className="kv" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid rgba(0,200,255,.06)', cursor: 'pointer' }} onClick={() => cycle(m.id)}>
          <span>{m.label}</span>
          <span style={{ color: snap(w[m.id]) === 1 ? 'var(--gold)' : snap(w[m.id]) ? 'var(--grn)' : 'var(--dim)' }}>{WEIGHT_LABEL[snap(w[m.id])]}</span>
        </button>
      ))}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => onSave(undefined)} title={`Auto: ${Object.keys(guessMuscles(exercise.name)).join(', ') || 'none'}`}>
          USE AUTO
        </button>
        <button className="btn btn-grn" onClick={() => onSave(Object.keys(w).length ? w : undefined)}>
          DONE
        </button>
      </div>
    </Dialog>
  );
}

function PoolEditor({ initial, onClose, onSave }: { initial: QuestTask[]; onClose: () => void; onSave: (p: QuestTask[]) => Promise<void> }) {
  const [pool, setPool] = useState<QuestTask[]>(structuredClone(initial));
  const [error, setError] = useState<string | null>(null);
  const set = (id: string, patch: Partial<QuestTask>) => setPool((p) => p.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const save = () => {
    const clean = pool.map((q) => ({ ...q, label: q.label.trim(), target: Number(q.target) }));
    if (clean.length < MIN_POOL) return setError(`Keep at least ${MIN_POOL} tasks so a quest can be drawn.`);
    if (clean.some((q) => !q.label || !(q.target > 0))) return setError('Every task needs a name and a target above 0.');
    void onSave(clean);
  };

  return (
    <Dialog title="QUEST POOL" onClose={onClose}>
      <p className="hint" style={{ marginBottom: 10 }}>
        Changes apply to future days. Past and already-started quests keep their tasks.
      </p>
      {pool.map((q) => (
        <div key={q.id} className="row" style={{ marginBottom: 8 }}>
          <input className="inp" style={{ flex: 2 }} aria-label="Task name" value={q.label} maxLength={30} onChange={(e) => set(q.id, { label: e.target.value })} />
          <input
            className="num-inp"
            style={{ flex: 1, minWidth: 0 }}
            type="number"
            min={1}
            aria-label={`${q.label} target`}
            value={q.target}
            onChange={(e) => set(q.id, { target: e.target.value as unknown as number })}
          />
          <select className="sel" style={{ flex: 1, minWidth: 0, padding: '10px 6px' }} aria-label={`${q.label} unit`} value={String(q.unit)} onChange={(e) => set(q.id, { unit: e.target.value })}>
            {QUEST_UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <button className="remove-btn" aria-label={`Remove ${q.label}`} onClick={() => setPool((p) => p.filter((x) => x.id !== q.id))}>
            ×
          </button>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => setPool((p) => [...p, { id: uid(), label: '', target: 10, unit: 'reps' }])}>
        + ADD TASK
      </button>
      <ErrorText error={error} />
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onClose}>
          CANCEL
        </button>
        <button className="btn btn-grn" onClick={save}>
          SAVE
        </button>
      </div>
    </Dialog>
  );
}
