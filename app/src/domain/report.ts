import { addDays, weekOf } from './dates';
import { dayLoads, MUSCLES } from './muscles';
import type { Ledger } from './ledger';
import type { DateStr, Logs, Muscle, Template } from './types';

export interface WeeklyReport {
  weekStart: DateStr;
  cleared: number;
  verified: number;
  rested: number;
  missed: number;
  exp: number;
  ep: number;
  hardSets: number;
  strongest: { muscle: Muscle; label: string; sets: number } | null;
  neglected: { muscle: Muscle; label: string } | null;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
  focus: string;
}

const MAJOR: Muscle[] = ['chest', 'lats', 'quads', 'hamstrings', 'glutes', 'front_delts', 'abs', 'triceps', 'biceps', 'calves'];

/** The System's review of a Monday–Sunday week. */
export function weeklyReport(ledger: Ledger, logs: Logs, templates: Template[], weekStart: DateStr): WeeklyReport {
  const week = weekOf(weekStart);
  const loads = dayLoads(logs, templates);
  const muscles: Partial<Record<Muscle, number>> = {};
  let hardSets = 0;
  for (const d of week) {
    const l = loads[d];
    if (!l) continue;
    hardSets += l.questHse + l.trainingHse;
    for (const [m, v] of Object.entries(l.muscles) as [Muscle, number][]) muscles[m] = (muscles[m] ?? 0) + v;
  }
  const label = (m: Muscle) => MUSCLES.find((x) => x.id === m)!.label;
  const ranked = (Object.entries(muscles) as [Muscle, number][]).sort((a, b) => b[1] - a[1]);
  const strongest = ranked[0] ? { muscle: ranked[0][0], label: label(ranked[0][0]), sets: Math.round(ranked[0][1] * 10) / 10 } : null;
  const neglectedId = MAJOR.find((m) => !muscles[m]) ?? [...MAJOR].sort((a, b) => (muscles[a] ?? 0) - (muscles[b] ?? 0))[0]!;
  const results = week.map((d) => ledger.days[d]).filter(Boolean);
  const count = (s: string) => results.filter((r) => r!.status === s).length;
  const verified = count('verified');
  const cleared = verified + count('unverified');
  const missed = count('missed');
  const ep = results.reduce((s, r) => s + r!.ep, 0);
  const grade = verified === 7 ? 'S' : cleared >= 6 && !missed ? 'A' : cleared >= 5 ? 'B' : cleared >= 3 ? 'C' : cleared >= 1 ? 'D' : 'E';
  const focus = missed
    ? `You missed ${missed} day${missed > 1 ? 's' : ''}. Set a reminder time you can keep, and use your rest day on purpose.`
    : verified < cleared
      ? 'Attach proof every day: unverified clears earn half EXP and don’t grow your streak.'
      : `Give ${label(neglectedId)} some work this week.`;
  return {
    weekStart: week[0]!,
    cleared,
    verified,
    rested: count('rest'),
    missed,
    exp: results.reduce((s, r) => s + r!.total, 0),
    ep,
    hardSets: Math.round(hardSets),
    strongest,
    neglected: { muscle: neglectedId, label: label(neglectedId) },
    grade,
    focus,
  };
}

/** Monday of last week, the week the report covers when opened on any day this week. */
export const lastWeekStart = (today: DateStr) => weekOf(addDays(today, -7))[0]!;
