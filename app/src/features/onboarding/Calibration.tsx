import { useMemo, useState } from 'react';
import {
  buildPool,
  dailyQuest,
  DEFAULT_PREFS,
  EQUIPMENT_LABEL,
  GOAL_LABEL,
  libraryExercise,
  LIMIT_LABEL,
  PATTERN_LABEL,
  QUEST_PATTERNS,
  todayStr,
  type Equipment,
  type Experience,
  type Focus,
  type Goal,
  type Limitation,
  type Preferences,
  type Tier,
} from '../../domain';
import { Seg } from '../../ui/components';

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: Record<T, string>; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {(Object.keys(options) as T[]).map((k) => {
        const on = value.includes(k);
        return (
          <button key={k} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}>
            {options[k]}
          </button>
        );
      })}
    </div>
  );
}

const PUSHUPS: { value: Experience; label: string }[] = [
  { value: 'beginner', label: 'UNDER 10' },
  { value: 'intermediate', label: '10–25' },
  { value: 'advanced', label: '25+' },
];

/** System calibration: answers decide which exercises go into the quest pool. */
export function Calibration({ initial, tier = 0, submitLabel, onSubmit }: { initial?: Preferences; tier?: number; submitLabel: string; onSubmit: (p: Preferences) => void | Promise<void> }) {
  const [goals, setGoals] = useState<Goal[]>(initial?.goals ?? DEFAULT_PREFS.goals);
  const [equipment, setEquipment] = useState<Equipment[]>(initial?.equipment ?? []);
  const [experience, setExperience] = useState<Experience>(initial?.experience ?? 'beginner');
  const [minutes, setMinutes] = useState<Preferences['minutes']>(initial?.minutes ?? 30);
  const [focus, setFocus] = useState<Focus>(initial?.focus ?? 'balanced');
  const [limits, setLimits] = useState<Limitation[]>(initial?.limits ?? []);
  const [busy, setBusy] = useState(false);

  const prefs = useMemo<Preferences>(() => {
    const base = { goals, equipment, experience, minutes, focus, limits };
    return { ...base, pool: buildPool(base) };
  }, [goals, equipment, experience, minutes, focus, limits]);
  const preview = useMemo(() => dailyQuest(todayStr(), { tier: tier as Tier, progress: 0, prefs }), [prefs, tier]);

  return (
    <div className="calibration">
      <span className="label">1 · WHAT ARE YOU TRAINING FOR?</span>
      <Chips label="Goals" options={GOAL_LABEL} value={goals} onChange={setGoals} />

      <span className="label">2 · EQUIPMENT YOU CAN USE</span>
      <Chips label="Equipment" options={EQUIPMENT_LABEL} value={equipment} onChange={setEquipment} />
      <p className="hint">Nothing selected = bodyweight only. That's enough to reach S-rank.</p>

      <span className="label">3 · PUSH-UPS IN A ROW, GOOD FORM</span>
      <Seg label="Push-ups in a row" value={experience} onChange={setExperience} options={PUSHUPS} />

      <span className="label">4 · TIME PER DAY</span>
      <Seg
        label="Minutes per day"
        value={String(minutes) as '15' | '30' | '45' | '60'}
        onChange={(v) => setMinutes(Number(v) as Preferences['minutes'])}
        options={[
          { value: '15', label: '15 MIN' },
          { value: '30', label: '30 MIN' },
          { value: '45', label: '45 MIN' },
          { value: '60', label: '60 MIN' },
        ]}
      />

      <span className="label">5 · FOCUS</span>
      <Seg
        label="Focus"
        value={focus}
        onChange={setFocus}
        options={[
          { value: 'balanced', label: 'BALANCED' },
          { value: 'upper', label: 'UPPER' },
          { value: 'lower', label: 'LOWER' },
          { value: 'core', label: 'CORE' },
        ]}
      />

      <span className="label">6 · ANYTHING TO GO EASY ON?</span>
      <Chips label="Limitations" options={LIMIT_LABEL} value={limits} onChange={setLimits} />
      <p className="hint">Exercises that load these joints are left out. This isn't medical advice: if something hurts, stop and see a professional.</p>

      <div className="calib-preview">
        <div className="label" style={{ color: 'var(--glow)' }}>
          YOUR POOL · {prefs.pool.length} EXERCISES
        </div>
        <div className="pool-summary">
          {QUEST_PATTERNS.map((p) => {
            const n = prefs.pool.filter((id) => libraryExercise(id)?.pattern === p).length;
            return (
              <span key={p} className={n ? '' : 'muted'}>
                {PATTERN_LABEL[p]} <b>{n}</b>
              </span>
            );
          })}
        </div>
        <div className="label" style={{ marginTop: 10 }}>
          TODAY'S QUEST WOULD BE
        </div>
        {preview.tasks.map((t) => (
          <div className="kv" key={t.id}>
            <span>{t.label}</span>
            <span>
              {t.target} {t.unit}
            </span>
          </div>
        ))}
        <p className="hint">Exercises get harder as you rank up: incline push-ups at E-rank, one-arm push-ups at S.</p>
      </div>

      <button
        type="button"
        className="btn btn-grn"
        style={{ marginTop: 12, padding: 14 }}
        disabled={busy || !goals.length}
        onClick={async () => {
          setBusy(true);
          try {
            await onSubmit(prefs);
          } finally {
            setBusy(false);
          }
        }}
      >
        {submitLabel}
      </button>
    </div>
  );
}
