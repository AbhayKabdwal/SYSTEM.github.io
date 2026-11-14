import { libraryExercise } from './library';
import type { DateStr, ExerciseSet, Logs, Template } from './types';

// Personal records from everything already logged: best single set per exercise,
// heaviest estimated lift, longest hold, and biggest quest-task day.

export interface PersonalRecord {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** Shown instead of value + unit when set, e.g. "80 kg × 5". */
  detail?: string;
  date: DateStr;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** One-rep max estimate (Epley). */
export const e1rm = (kg: number, reps: number) => Math.round(kg * (1 + reps / 30));

function setScore(unit: string, s: ExerciseSet): { value: number; unit: string; detail?: string } | null {
  if (unit === 'kg') {
    const kg = num(s.v);
    const reps = num(s.reps);
    if (!reps) return null;
    if (!kg) return { value: reps, unit: 'reps' };
    return { value: e1rm(kg, reps), unit: 'kg est. 1RM', detail: `${kg} kg × ${reps}` };
  }
  if (unit === 'stage') return num(s.seconds) ? { value: num(s.seconds), unit: `s · ${s.v ?? ''}` } : null;
  const v = num(s.v);
  return v ? { value: v, unit } : null;
}

export function personalRecords(logs: Logs, templates: Template[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  const offer = (r: PersonalRecord) => {
    const cur = best.get(r.key);
    if (!cur || r.value > cur.value) best.set(r.key, r);
  };
  for (const date of Object.keys(logs).sort()) {
    const log = logs[date]!;
    for (const t of log.dailyQuest?.tasks ?? []) {
      const v = num(log.questProgress?.[t.id]);
      if (v) offer({ key: `quest:${t.id}`, label: `${t.label} (one day)`, value: v, unit: String(t.unit), date });
    }
    const tpl = templates.find((x) => x.id === log.templateId);
    for (const ex of tpl?.exercises ?? []) {
      for (const s of log.exLogs?.[ex.id]?.sets ?? []) {
        const sc = setScore(String(ex.unit), s);
        if (sc) offer({ key: `ex:${ex.id}`, label: ex.name, value: sc.value, unit: sc.unit, detail: sc.detail, date });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));
}

/** Records set on `date` that beat everything before it. */
export function newRecords(logs: Logs, templates: Template[], date: DateStr): PersonalRecord[] {
  const before = Object.fromEntries(Object.entries(logs).filter(([d]) => d < date));
  const prev = new Map(personalRecords(before, templates).map((r) => [r.key, r.value]));
  return personalRecords(Object.fromEntries(Object.entries(logs).filter(([d]) => d <= date)), templates).filter(
    (r) => r.date === date && prev.has(r.key) && r.value > prev.get(r.key)!,
  );
}

/** Library ids map to a friendly name, for records keyed by quest task. */
export const recordName = (id: string) => libraryExercise(id)?.name ?? id;
