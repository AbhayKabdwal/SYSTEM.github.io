import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  addDays,
  EXP_PER_RANK_POINT,
  getRank,
  getSkillState,
  isComplete,
  isPenalty,
  questForDate,
  stageOptions,
  totalExp,
  treeForExercise,
  treeUnit,
  type DailyLog,
  type Exercise,
  type ExerciseSet,
  type Quest,
  type SkillState,
} from '../../domain';
import { useApp } from '../../state/store';
import { createRepo } from '../../data/repo';
import { Card, Sec } from '../../ui/components';
import { compressImage } from '../../ui/image';
import { systemAlert, toast } from '../../ui/notify';
import { usePhotoUrl, useToday } from '../../ui/hooks';

const repo = createRepo();
/** How far back logs can be edited. Older days are read-only history. */
export const EDIT_WINDOW_DAYS = 7;
const PHOTO_LABELS = ['FRONT', 'SIDE', 'BACK'] as const;

interface Draft {
  questProgress: Record<string, string | number>;
  recovery: { water: number; creatine: boolean };
  templateId: string;
  exLogs: Record<string, { sets: ExerciseSet[] }>;
  photoIds: (string | null)[];
}

function draftFrom(log: DailyLog | undefined): Draft {
  return {
    questProgress: { ...(log?.questProgress ?? {}) },
    recovery: { water: log?.recovery?.water ?? 0, creatine: log?.recovery?.creatine ?? false },
    templateId: log?.templateId ?? '',
    exLogs: Object.fromEntries(Object.entries(log?.exLogs ?? {}).map(([k, v]) => [k, { sets: [...(v.sets ?? [])] }])),
    photoIds: [...(log?.photoIds ?? [null, null, null])],
  };
}

export function QuestPage() {
  const { logs, templates, questPool, player, saveLog } = useApp();
  const today = useToday();
  const requested = (useLocation().state as { date?: string } | null)?.date;
  const [date, setDate] = useState(() => (requested && requested <= today && requested >= addDays(today, -EDIT_WINDOW_DAYS) ? requested : today));
  const saved = logs[date];
  const [draft, setDraft] = useState<Draft>(() => draftFrom(saved));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reload the form when the date changes or the saved log is replaced (e.g. by sync).
  const loadedFor = useRef<{ date: string; log: DailyLog | undefined }>({ date, log: saved });
  useEffect(() => {
    const prev = loadedFor.current;
    if (prev.date !== date || (prev.log !== saved && !dirty)) {
      setDraft(draftFrom(saved));
      setDirty(false);
      loadedFor.current = { date, log: saved };
    }
  }, [date, saved, dirty]);

  const penalty = date === today && isPenalty(logs, today);
  const quest: Quest = saved?.dailyQuest ?? questForDate(date, { today, penalty, pool: questPool, logs });
  const skills = useMemo(() => getSkillState(logs, templates), [logs, templates]);
  const tpl = templates.find((t) => t.id === draft.templateId);

  const edit = (fn: (d: Draft) => Draft) => {
    setDraft(fn);
    setDirty(true);
  };

  const setSets = (exId: string, fn: (sets: ExerciseSet[]) => ExerciseSet[]) =>
    edit((d) => ({ ...d, exLogs: { ...d.exLogs, [exId]: { sets: fn(d.exLogs[exId]?.sets ?? []) } } }));

  async function save() {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const hasTraining = !!tpl && Object.values(draft.exLogs).some((e) => e.sets.length);
      const log: DailyLog = {
        ...saved,
        dailyQuest: quest,
        questProgress: draft.questProgress,
        recovery: draft.recovery,
        penaltyAttempt: saved?.penaltyAttempt ?? penalty,
        templateId: draft.templateId || undefined,
        exLogs: draft.exLogs,
        photoIds: draft.photoIds,
        savedAt: now,
        ...(hasTraining ? { trainingSavedAt: now } : {}),
      };
      log.penaltyCleared = !!log.penaltyAttempt && isComplete(log);

      const before = totalExp(logs, templates);
      const wasDone = isComplete(saved);
      await saveLog(date, log);
      // Photos replaced or removed in this edit are no longer referenced anywhere.
      for (const id of saved?.photoIds ?? []) if (id && !draft.photoIds.includes(id)) await repo.deletePhoto(id);

      const after = totalExp({ ...logs, [date]: log }, templates);
      const gained = after - before;
      const rankBefore = getRank(before / EXP_PER_RANK_POINT);
      const rankAfter = getRank(after / EXP_PER_RANK_POINT);
      setDirty(false);
      loadedFor.current = { date, log };

      if (rankAfter.level > rankBefore.level) systemAlert(`RANK UP\nLVL ${rankAfter.level} — ${rankAfter.title.toUpperCase()}`);
      else if (!wasDone && isComplete(log)) systemAlert(`${log.penaltyAttempt ? 'PENALTY QUEST CLEARED' : 'QUEST COMPLETED'}\n+${gained} EXP`);
      else toast(gained > 0 ? `SAVED · +${gained} EXP` : 'LOG SAVED');
    } catch (e) {
      toast(`SAVE FAILED: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function onPhoto(i: number, file: File | undefined) {
    if (!file) return;
    try {
      const id = await repo.putPhoto(await compressImage(file));
      const old = draft.photoIds[i];
      // An unsaved photo that is being replaced can go right away.
      if (old && !saved?.photoIds?.includes(old)) await repo.deletePhoto(old);
      edit((d) => ({ ...d, photoIds: d.photoIds.map((p, j) => (j === i ? id : p)) }));
    } catch {
      toast('IMAGE UPLOAD FAILED');
    }
  }

  const minDate = addDays(today, -EDIT_WINDOW_DAYS);
  const waterTarget = player?.waterTarget ?? 8;

  return (
    <div className="page">
      <Card>
        <Sec>LOG DATE</Sec>
        <input
          type="date"
          className="inp"
          aria-label="Log date"
          value={date}
          min={minDate}
          max={today}
          onChange={(e) => {
            const v = e.target.value;
            if (!v || v > today || v < minDate) return;
            if (dirty && !confirm('Discard unsaved changes for this day?')) return;
            setDirty(false);
            setDate(v);
          }}
        />
        <p className="hint">You can log or edit the last {EDIT_WINDOW_DAYS} days. Older days are in Archives.</p>
      </Card>

      <Card className={penalty ? 'penalty-card' : ''}>
        <Sec>{penalty ? 'MANDATORY CLEAR' : 'DAILY QUEST'}</Sec>
        <div className="label" style={{ color: penalty ? 'var(--red)' : 'var(--bright)' }}>
          {quest.name}
        </div>
        {quest.tasks.map((task) => {
          const val = Number(draft.questProgress[task.id] ?? 0);
          const pct = Math.min((val / task.target) * 100, 100);
          return (
            <div key={task.id} className={`quest-row${val >= task.target ? ' done' : ''}`}>
              <div className="quest-info">
                <div className="quest-label">{task.label}</div>
                <div className="quest-prog">
                  <div className="quest-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <input
                className="num-inp"
                type="number"
                inputMode="decimal"
                min={0}
                step={task.unit === 'km' ? 0.1 : 1}
                aria-label={`${task.label} done`}
                placeholder="0"
                value={draft.questProgress[task.id] ?? ''}
                onChange={(e) => edit((d) => ({ ...d, questProgress: { ...d.questProgress, [task.id]: e.target.value } }))}
              />
              <button
                className="btn btn-sm"
                aria-label={`Mark ${task.label} complete`}
                onClick={() => edit((d) => ({ ...d, questProgress: { ...d.questProgress, [task.id]: task.target } }))}
              >
                MAX
              </button>
              <div className="quest-target">
                /{task.target}
                <br />
                {task.unit}
              </div>
            </div>
          );
        })}
      </Card>

      <Card>
        <Sec>RECOVERY</Sec>
        <div className="rec-grid">
          <div className="rec-card">
            <div className="label">WATER (GLASSES)</div>
            <div className="counter">
              <button className="icon-btn" aria-label="Less water" onClick={() => edit((d) => ({ ...d, recovery: { ...d.recovery, water: Math.max(0, d.recovery.water - 1) } }))}>
                −
              </button>
              <div className="counter-val" aria-live="polite">
                {draft.recovery.water}
              </div>
              <button className="icon-btn" aria-label="More water" onClick={() => edit((d) => ({ ...d, recovery: { ...d.recovery, water: Math.min(30, d.recovery.water + 1) } }))}>
                +
              </button>
            </div>
            <div className="hint" style={{ textAlign: 'center' }}>
              target {waterTarget}
            </div>
          </div>
          <div className="rec-card" style={{ display: 'flex', alignItems: 'center' }}>
            <label className="check">
              <input type="checkbox" checked={draft.recovery.creatine} onChange={(e) => edit((d) => ({ ...d, recovery: { ...d.recovery, creatine: e.target.checked } }))} />
              <span>
                <span className="label" style={{ marginBottom: 2 }}>
                  SUPPLEMENT
                </span>
                <span style={{ fontFamily: 'var(--hd)', fontSize: 12, color: 'var(--bright)' }}>CREATINE</span>
              </span>
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <Sec>TRAINING SESSION (OPTIONAL)</Sec>
        <label className="label" htmlFor="tpl-select">
          TRAINING TYPE
        </label>
        <select id="tpl-select" className="sel" value={draft.templateId} onChange={(e) => edit((d) => ({ ...d, templateId: e.target.value }))}>
          <option value="">— SELECT TYPE —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 12 }}>
          {tpl?.exercises.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} sets={draft.exLogs[ex.id]?.sets ?? []} skills={skills} onChange={(fn) => setSets(ex.id, fn)} />
          ))}
          {tpl && !tpl.exercises.length && <p className="hint">This training type has no exercises yet. Add some in Training.</p>}
        </div>

        <div className="label" style={{ marginTop: 14 }}>
          PROGRESS PHOTOS · STAY ON THIS DEVICE
        </div>
        <div className="photo-grid">
          {PHOTO_LABELS.map((lbl, i) => (
            <PhotoSlot
              key={lbl}
              label={lbl}
              id={draft.photoIds[i] ?? null}
              onPick={(f) => onPhoto(i, f)}
              onRemove={() => edit((d) => ({ ...d, photoIds: d.photoIds.map((p, j) => (j === i ? null : p)) }))}
            />
          ))}
        </div>
      </Card>

      <div style={{ position: 'sticky', bottom: 8, zIndex: 2 }}>
        <button className="btn btn-grn" style={{ background: 'var(--bg)' }} disabled={saving || (!dirty && !!saved)} onClick={save}>
          {saving ? 'SAVING…' : dirty || !saved ? '◆ SAVE LOG ◆' : '✓ SAVED'}
        </button>
      </div>
    </div>
  );
}

function ExerciseCard({ ex, sets, skills, onChange }: { ex: Exercise; sets: ExerciseSet[]; skills: SkillState; onChange: (fn: (s: ExerciseSet[]) => ExerciseSet[]) => void }) {
  const unit = String(ex.unit);
  const isKg = unit === 'kg';
  const isStage = unit === 'stage';
  const cols = isKg || isStage ? '28px 1.3fr 1fr 32px' : '28px 1fr 32px';
  const update = (i: number, patch: ExerciseSet) => onChange((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const options = isStage ? stageOptions(ex, skills) : [];
  const stageUnit = isStage ? treeUnit(treeForExercise(ex)) : '';

  return (
    <div className="ex-card">
      <div className="ex-hdr">
        <div>
          <div className="ex-name">{ex.name}</div>
          <div className="ex-unit">{isKg ? 'WEIGHT (KG) × REPS' : isStage ? `STAGE × ${stageUnit.toUpperCase()}` : unit.toUpperCase()}</div>
        </div>
        <button className="btn btn-sm" onClick={() => onChange((s) => [...s, { ...(s[s.length - 1] ?? {}) }])}>
          + SET
        </button>
      </div>
      {sets.length > 0 && (isKg || isStage) && (
        <div className="set-row" style={{ gridTemplateColumns: cols, paddingBottom: 0, borderTop: 'none' }}>
          <span />
          <span className="set-head">{isKg ? 'KG' : 'STAGE'}</span>
          <span className="set-head">{isKg ? 'REPS' : stageUnit.toUpperCase()}</span>
          <span />
        </div>
      )}
      {sets.map((set, i) => (
        <div key={i} className="set-row" style={{ gridTemplateColumns: cols }}>
          <div className="set-num">{i + 1}</div>
          {isStage ? (
            <>
              <select className="sel" style={{ padding: '6px 8px', fontSize: 14 }} aria-label={`Set ${i + 1} stage`} value={String(set.v ?? '')} onChange={(e) => update(i, { v: e.target.value })}>
                <option value="">STAGE</option>
                {options.map((n) => (
                  <option key={n.id} value={n.label} disabled={n.locked}>
                    {n.locked ? '🔒 ' : ''}
                    {n.label}
                  </option>
                ))}
              </select>
              <NumInput label={`Set ${i + 1} ${stageUnit}`} value={set.seconds} onChange={(v) => update(i, { seconds: v })} />
            </>
          ) : isKg ? (
            <>
              <NumInput label={`Set ${i + 1} weight`} value={set.v} step={0.5} onChange={(v) => update(i, { v })} />
              <NumInput label={`Set ${i + 1} reps`} value={set.reps} onChange={(v) => update(i, { reps: v })} />
            </>
          ) : (
            <NumInput label={`Set ${i + 1} ${unit}`} value={set.v} step={unit === 'km' ? 0.1 : 1} onChange={(v) => update(i, { v })} />
          )}
          <button className="remove-btn" aria-label={`Remove set ${i + 1}`} onClick={() => onChange((s) => s.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function NumInput({ value, onChange, label, step = 1 }: { value: unknown; onChange: (v: string) => void; label: string; step?: number }) {
  return (
    <input
      className="num-inp"
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      placeholder="0"
      aria-label={label}
      value={value === undefined || value === null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function PhotoSlot({ id, label, onPick, onRemove }: { id: string | null; label: string; onPick: (f: File | undefined) => void; onRemove: () => void }) {
  const url = usePhotoUrl(id);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button className="photo-slot" onClick={() => input.current?.click()} aria-label={`${url ? 'Change' : 'Add'} ${label.toLowerCase()} photo`}>
        {url ? <img src={url} alt="" /> : <>📷<span style={{ marginTop: 4 }}>ADD</span></>}
      </button>
      <div className="row" style={{ justifyContent: 'center' }}>
        <span className="photo-lbl">{label}</span>
        {id && (
          <button className="link-btn" onClick={onRemove} style={{ marginLeft: 6 }}>
            remove
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
