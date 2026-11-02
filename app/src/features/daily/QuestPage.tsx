import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  addDays,
  computeLedger,
  dungeonQuest,
  EXP,
  getSkillState,
  isComplete,
  questDone,
  RANK_GATES,
  restAvailable,
  stageOptions,
  treeForExercise,
  treeUnit,
  trialQuest,
  weekOf,
  type DailyLog,
  type Exercise,
  type ExerciseSet,
  type Quest,
  type SideQuestKind,
  type SkillState,
  type Tier,
  type Visibility,
} from '../../domain';
import { useApp } from '../../state/store';
import { useSession } from '../../state/session';
import { cloudEnabled } from '../../cloud/client';
import { deleteFeat, postFeat } from '../../cloud/social';
import { createRepo } from '../../data/repo';
import { Card, Sec, Seg } from '../../ui/components';
import { compressImage } from '../../ui/image';
import { systemAlert, toast } from '../../ui/notify';
import { useLedger, usePhotoUrl, useQuestFor, useToday } from '../../ui/hooks';

const repo = createRepo();
/** How far back logs can be edited. Older days are read-only history. */
export const EDIT_WINDOW_DAYS = 7;
const PHOTO_LABELS = ['FRONT', 'SIDE', 'BACK'] as const;

const VIS_KEY = 'sys:proofVisibility';

interface Draft {
  questProgress: Record<string, string | number>;
  recovery: { water: number; creatine: boolean };
  templateId: string;
  exLogs: Record<string, { sets: ExerciseSet[] }>;
  photoIds: (string | null)[];
  side: Partial<Record<SideQuestKind, Record<string, string | number>>>;
}

function draftFrom(log: DailyLog | undefined): Draft {
  return {
    questProgress: { ...(log?.questProgress ?? {}) },
    recovery: { water: log?.recovery?.water ?? 0, creatine: log?.recovery?.creatine ?? false },
    templateId: log?.templateId ?? '',
    exLogs: Object.fromEntries(Object.entries(log?.exLogs ?? {}).map(([k, v]) => [k, { sets: [...(v.sets ?? [])] }])),
    photoIds: [...(log?.photoIds ?? [null, null, null])],
    side: Object.fromEntries(Object.entries(log?.side ?? {}).map(([k, v]) => [k, { ...v!.progress }])),
  };
}

function readVis(): Visibility {
  try {
    const v = localStorage.getItem(VIS_KEY);
    if (v === 'private' || v === 'followers' || v === 'public') return v;
  } catch {
    /* storage blocked */
  }
  return 'private';
}

export function QuestPage() {
  const { logs, templates, player, saveLog } = useApp();
  const user = useSession((s) => s.user);
  const today = useToday();
  const ledger = useLedger();
  const navState = useLocation().state as { date?: string; focus?: SideQuestKind } | null;
  const requested = navState?.date;
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

  const penalty = date === today && ledger.penaltyToday;
  const quest: Quest = useQuestFor(date, ledger);
  const skills = useMemo(() => getSkillState(logs, templates), [logs, templates]);
  const tpl = templates.find((t) => t.id === draft.templateId);
  const isToday = date === today;
  const status = ledger.days[date]?.status;
  const questCleared = questDone(quest, draft.questProgress);
  const [visibility, setVisibility] = useState<Visibility>(readVis);
  const [proofBusy, setProofBusy] = useState(false);

  // Side quests are only offered today, and only once you've calibrated.
  const prefs = player?.prefs;
  const nextGate = RANK_GATES[ledger.tier + 1];
  const sideQuests = useMemo(() => {
    const out: Partial<Record<SideQuestKind, Quest>> = {};
    const savedSide = saved?.side ?? {};
    if (savedSide.trial) out.trial = savedSide.trial.quest;
    else if (isToday && prefs && ledger.trialReady) out.trial = trialQuest((ledger.tier + 1) as Tier, prefs);
    if (savedSide.dungeon) out.dungeon = savedSide.dungeon.quest;
    else if (isToday && prefs && !ledger.dungeonWeeks.has(weekOf(today)[0]!))
      out.dungeon = dungeonQuest(weekOf(today)[0]!, { tier: ledger.tier as Tier, progress: ledger.rankProgress, prefs });
    return out;
  }, [saved, isToday, prefs, ledger.trialReady, ledger.tier, ledger.dungeonWeeks, ledger.rankProgress, today]);
  const [openSide, setOpenSide] = useState<SideQuestKind | null>(navState?.focus ?? null);
  const sideRefs = useRef<Partial<Record<SideQuestKind, HTMLDivElement | null>>>({});
  useEffect(() => {
    if (navState?.focus) sideRefs.current[navState.focus]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [navState?.focus]);

  const edit = (fn: (d: Draft) => Draft) => {
    setDraft(fn);
    setDirty(true);
  };

  const setSets = (exId: string, fn: (sets: ExerciseSet[]) => ExerciseSet[]) =>
    edit((d) => ({ ...d, exLogs: { ...d.exLogs, [exId]: { sets: fn(d.exLogs[exId]?.sets ?? []) } } }));

  function buildLog(base: DailyLog | undefined, d: Draft, extra: Partial<DailyLog> = {}): DailyLog {
    const now = new Date().toISOString();
    const hasTraining = !!tpl && Object.values(d.exLogs).some((e) => e.sets.length);
    const side: DailyLog['side'] = {};
    for (const [k, q] of Object.entries(sideQuests) as [SideQuestKind, Quest][]) {
      const progress = d.side[k];
      // Only keep side quests the player actually started.
      if (base?.side?.[k] || (progress && Object.values(progress).some((v) => Number(v) > 0))) {
        side[k] = { quest: q, progress: progress ?? {}, ...(k === 'trial' ? { rank: base?.side?.trial?.rank ?? nextGate?.rank } : {}) };
      }
    }
    const log: DailyLog = {
      ...base,
      dailyQuest: quest,
      questProgress: d.questProgress,
      recovery: d.recovery,
      penaltyAttempt: base?.penaltyAttempt ?? penalty,
      templateId: d.templateId || undefined,
      exLogs: d.exLogs,
      photoIds: d.photoIds,
      savedAt: now,
      ...(hasTraining ? { trainingSavedAt: now } : {}),
      ...(Object.keys(side).length ? { side } : {}),
      ...extra,
    };
    log.penaltyCleared = !!log.penaltyAttempt && isComplete(log);
    return log;
  }

  /** Saves and announces what changed: EXP, level, promotion, streak. */
  async function commit(log: DailyLog) {
    const before = ledger;
    await saveLog(date, log);
    for (const id of saved?.photoIds ?? []) if (id && !log.photoIds?.includes(id)) await repo.deletePhoto(id);
    const after = computeLedger({ ...logs, [date]: log }, templates, player, today);
    setDirty(false);
    loadedFor.current = { date, log };
    const gained = after.exp - before.exp;
    const wasDone = isComplete(saved);
    if (after.tier > before.tier) systemAlert(`RANK UP\nYOU ARE NOW ${after.rank}-RANK\nQuests move to harder variations.`);
    else if (after.level > before.level) systemAlert(`LEVEL UP\nLVL ${after.level} — ${after.title.title.toUpperCase()}`);
    else if (after.days[date]?.restored && !before.days[date]?.restored) systemAlert(`PENALTY ZONE SURVIVED\n${after.streak}-day streak restored`);
    else if (!wasDone && isComplete(log))
      systemAlert(
        `${log.penaltyAttempt ? 'PENALTY QUEST CLEARED' : 'QUEST COMPLETED'}\n+${gained} EXP${after.days[date]?.status === 'unverified' && isToday ? '\nAttach proof for full EXP and to grow your streak.' : ''}`,
      );
    else toast(gained > 0 ? `SAVED · +${gained} EXP` : gained < 0 ? `SAVED · ${gained} EXP` : 'LOG SAVED');
  }

  async function save() {
    setSaving(true);
    try {
      await commit(buildLog(saved, draft));
    } catch (e) {
      toast(`SAVE FAILED: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function setRest(rest: boolean) {
    if (rest && !confirm('Take your rest day for this week? Your streak is kept, but momentum resets and this week cannot be a perfect week.')) return;
    setSaving(true);
    try {
      await commit({ ...(saved ?? {}), rest, savedAt: new Date().toISOString() });
      if (rest) systemAlert('REST DAY ACCEPTED\nRecover well. Your streak is safe.');
    } finally {
      setSaving(false);
    }
  }

  async function attachProof(file: File | undefined) {
    if (!file) return;
    setProofBusy(true);
    try {
      const blob = await compressImage(file);
      const photoId = await repo.putPhoto(blob);
      let featId: string | undefined;
      const vis: Visibility = visibility !== 'private' && user ? visibility : 'private';
      if (vis !== 'private' && user) {
        const title = penalty ? 'Survived the penalty quest' : `Cleared the ${ledger.rank}-Rank daily quest`;
        const body = quest.tasks.map((t) => `${t.target} ${t.unit} ${t.label}`).join(' · ');
        featId = await postFeat(user.id, { kind: 'proof', title, body, visibility: vis }, blob);
      }
      const old = saved?.proof;
      await commit(buildLog(saved, draft, { proof: { photoId, at: new Date().toISOString(), visibility: vis, ...(featId ? { featId } : {}) } }));
      if (old) await removeProofArtifacts(old.photoId, old.featId);
    } catch (e) {
      toast(`PROOF FAILED: ${(e as Error).message}`);
    } finally {
      setProofBusy(false);
    }
  }

  async function removeProofArtifacts(photoId: string, featId?: string) {
    await repo.deletePhoto(photoId);
    if (featId && user) await deleteFeat(featId).catch(() => toast('Could not delete the shared post. Remove it from Hunters.'));
  }

  async function removeProof() {
    const old = saved?.proof;
    if (!old || !confirm('Remove proof? Today will count as unverified: half EXP and no streak growth.')) return;
    const { proof: _proof, ...rest } = saved!;
    await commit({ ...rest, savedAt: new Date().toISOString() });
    await removeProofArtifacts(old.photoId, old.featId);
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

      {status === 'rest' && saved?.rest && (
        <Card className="rest-card">
          <Sec>REST DAY</Sec>
          <p className="prose">Recovery is part of training. Your streak is safe; momentum starts again tomorrow.</p>
          {isToday && (
            <button className="btn btn-sm" style={{ marginTop: 10 }} disabled={saving} onClick={() => setRest(false)}>
              CANCEL REST DAY
            </button>
          )}
        </Card>
      )}

      <Card className={penalty ? 'penalty-card' : ''}>
        <Sec>{penalty ? 'MANDATORY CLEAR' : 'DAILY QUEST'}</Sec>
        <div className="label" style={{ color: penalty ? 'var(--red)' : 'var(--bright)' }}>
          {quest.name}
        </div>
        {quest.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            value={draft.questProgress[task.id]}
            onChange={(v) => edit((d) => ({ ...d, questProgress: { ...d.questProgress, [task.id]: v } }))}
          />
        ))}
      </Card>

      {isToday && !!player?.rulesSince && !penalty && !saved?.rest && !isComplete(saved) && restAvailable(ledger, today) && (
        <button className="btn btn-sm rest-btn" disabled={saving || dirty} onClick={() => setRest(true)} title={dirty ? 'Save or discard your changes first' : undefined}>
          ☾ TAKE THIS WEEK'S REST DAY
        </button>
      )}

      {saved?.rest ? null : (
        <ProofCard
          isToday={isToday}
          cleared={questCleared}
          proofId={saved?.proof?.photoId ?? null}
          proof={saved?.proof}
          verified={status === 'verified'}
          visibility={visibility}
          canShare={cloudEnabled && !!user}
          busy={proofBusy}
          onVisibility={(v) => {
            setVisibility(v);
            try {
              localStorage.setItem(VIS_KEY, v);
            } catch {
              /* storage blocked */
            }
          }}
          onPick={attachProof}
          onRemove={removeProof}
          share={Math.round(EXP.unverifiedShare * 100)}
        />
      )}

      {(Object.entries(sideQuests) as [SideQuestKind, Quest][]).map(([kind, q]) => {
        const progress = draft.side[kind] ?? {};
        const done = questDone(q, progress);
        const open = openSide === kind || !!saved?.side?.[kind];
        return (
          <div key={kind} ref={(el) => (sideRefs.current[kind] = el)}>
            <Card className={kind === 'trial' ? 'trial-card' : 'dungeon-card'}>
              <Sec>{kind === 'trial' ? 'RANK-UP TRIAL' : 'WEEKLY INSTANT DUNGEON'}</Sec>
              <div className="label" style={{ color: kind === 'trial' ? 'var(--gold)' : 'var(--purple)' }}>
                {q.name}
                {done ? ' · CLEARED' : ''}
              </div>
              {!open ? (
                <>
                  <p className="prose">
                    {kind === 'trial'
                      ? `Prove you belong at ${nextGate?.rank}-Rank: next-rank variations at 1.3× volume. Clear it to be promoted (+${EXP.trialBase + EXP.trialPerTier * (ledger.tier + 1)} EXP).`
                      : `Optional boss run. Clear all five for +${EXP.dungeonBase + EXP.dungeonPerTier * ledger.tier} EXP. Once per week.`}
                  </p>
                  <button className="btn btn-gold" style={{ marginTop: 10 }} onClick={() => setOpenSide(kind)}>
                    {kind === 'trial' ? 'ENTER THE TRIAL' : 'ENTER DUNGEON'}
                  </button>
                </>
              ) : (
                q.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    value={progress[task.id]}
                    onChange={(v) => edit((d) => ({ ...d, side: { ...d.side, [kind]: { ...(d.side[kind] ?? {}), [task.id]: v } } }))}
                  />
                ))
              )}
            </Card>
          </div>
        );
      })}

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
  const cols = isKg ? '28px 1.2fr 1fr 0.8fr 32px' : isStage ? '28px 1.3fr 1fr 32px' : '28px 1fr 32px';
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
          {isKg && <span className="set-head" title="Optional effort, 1–10. 10 = nothing left.">RPE</span>}
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
              <NumInput label={`Set ${i + 1} RPE (optional)`} value={set.rpe} max={10} onChange={(v) => update(i, { rpe: v })} />
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

function NumInput({ value, onChange, label, step = 1, max }: { value: unknown; onChange: (v: string) => void; label: string; step?: number; max?: number }) {
  return (
    <input
      className="num-inp"
      type="number"
      inputMode="decimal"
      min={0}
      max={max}
      step={step}
      placeholder={max ? '–' : '0'}
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

function TaskRow({ task, value, onChange }: { task: Quest['tasks'][number]; value: string | number | undefined; onChange: (v: string | number) => void }) {
  const val = Number(value ?? 0);
  const pct = Math.min((val / task.target) * 100, 100);
  return (
    <div className={`quest-row${val >= task.target ? ' done' : ''}`}>
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
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
      <button className="btn btn-sm" aria-label={`Mark ${task.label} complete`} onClick={() => onChange(task.target)}>
        MAX
      </button>
      <div className="quest-target">
        /{task.target}
        <br />
        {task.unit}
      </div>
    </div>
  );
}

const VIS_LABEL: Record<Visibility, string> = { private: 'Only you, on this device', followers: 'Your followers', public: 'Everyone on Hunters' };

function ProofCard(props: {
  isToday: boolean;
  cleared: boolean;
  proofId: string | null;
  proof: DailyLog['proof'];
  verified: boolean;
  visibility: Visibility;
  canShare: boolean;
  busy: boolean;
  share: number;
  onVisibility: (v: Visibility) => void;
  onPick: (f: File | undefined) => void;
  onRemove: () => void;
}) {
  const url = usePhotoUrl(props.proofId);
  const input = useRef<HTMLInputElement>(null);
  if (!props.isToday) {
    return props.proof ? (
      <Card>
        <Sec>PROOF OF WORKOUT</Sec>
        <ProofImage url={url} />
        <p className="hint">Shared with: {VIS_LABEL[props.proof.visibility]}</p>
      </Card>
    ) : null;
  }
  return (
    <Card className={`proof-card${props.verified ? ' verified' : ''}`}>
      <Sec>PROOF OF WORKOUT</Sec>
      {props.proof ? (
        <>
          <ProofImage url={url} />
          <div className="row">
            <span className="label" style={{ color: 'var(--grn)', marginBottom: 0 }}>
              ✓ VERIFIED · {VIS_LABEL[props.proof.visibility].toUpperCase()}
            </span>
            <button className="link-btn" onClick={props.onRemove}>
              remove
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="prose">
            The System requires proof. Clear the quest, then snap a photo today. Without proof you keep only {props.share}% of the quest EXP and your streak
            doesn't grow.
          </p>
          <span className="label">WHO CAN SEE IT</span>
          <Seg
            label="Proof visibility"
            value={props.visibility}
            onChange={props.onVisibility}
            options={[
              { value: 'private', label: 'PRIVATE' },
              { value: 'followers', label: 'FOLLOWERS' },
              { value: 'public', label: 'GLOBAL' },
            ]}
          />
          <p className="hint" style={{ marginTop: -6 }}>
            {VIS_LABEL[props.visibility]}.{' '}
            {props.visibility !== 'private' && !props.canShare ? 'Sign in to share; until then it stays private.' : props.visibility !== 'private' ? 'Posted to Hunters with your quest.' : 'Never uploaded.'}
          </p>
          <button className="btn btn-grn" style={{ marginTop: 8 }} disabled={!props.cleared || props.busy} onClick={() => input.current?.click()}>
            {props.busy ? 'UPLOADING…' : props.cleared ? '📷 ATTACH PROOF' : 'CLEAR ALL TASKS FIRST'}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              props.onPick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </>
      )}
    </Card>
  );
}

const ProofImage = ({ url }: { url: string | null }) => (url ? <img className="proof-img" src={url} alt="Workout proof" /> : <div className="proof-img placeholder">📷</div>);
