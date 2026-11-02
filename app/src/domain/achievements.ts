import { SKILL_TREES } from './defaults';
import { getMonthly } from './progress';
import { flameFor, type Ledger } from './ledger';
import { getSkillState } from './skills';
import type { DateStr, Logs, Template } from './types';
import { isComplete } from './completion';

export type AchievementKind = 'rank' | 'streak' | 'skill' | 'monthly' | 'milestone' | 'quest';

/** Something worth sharing. Only these fields ever leave the device, and only if the user posts it. */
export interface Achievement {
  kind: AchievementKind;
  key: string;
  title: string;
  detail: string;
}

const STREAK_MARKS = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];
const CLEARED_MARKS = [1, 10, 25, 50, 100, 200, 365, 500, 1000];

export function achievements(ledger: Ledger, logs: Logs, templates: Template[], today: DateStr): Achievement[] {
  const out: Achievement[] = [];
  out.push({
    kind: 'rank',
    key: `rank:${ledger.rank}:${ledger.level}`,
    title: `${ledger.rank}-Rank · Level ${ledger.level}`,
    detail: `${ledger.title.title} · ${ledger.exp.toLocaleString('en')} EXP`,
  });

  const streakMark = [...STREAK_MARKS].reverse().find((m) => ledger.streak >= m);
  if (streakMark) {
    out.push({
      kind: 'streak',
      key: `streak:${streakMark}`,
      title: `${streakMark}-day streak · ${flameFor(ledger.streak).name}`,
      detail: `${ledger.streak} days without missing a quest`,
    });
  }
  if (ledger.perfectWeeks) {
    out.push({ kind: 'streak', key: `perfect:${ledger.perfectWeeks}`, title: `${ledger.perfectWeeks} perfect week${ledger.perfectWeeks > 1 ? 's' : ''}`, detail: 'Seven verified clears in a week, no rest day' });
  }

  const clearedMark = [...CLEARED_MARKS].reverse().find((m) => ledger.cleared >= m);
  if (clearedMark) {
    out.push({
      kind: 'milestone',
      key: `cleared:${clearedMark}`,
      title: clearedMark === 1 ? 'First quest cleared' : `${clearedMark} quests cleared`,
      detail: `${ledger.cleared} daily quest${ledger.cleared === 1 ? '' : 's'} cleared in total`,
    });
  }
  if (ledger.dungeonWeeks.size) {
    out.push({ kind: 'milestone', key: `dungeons:${ledger.dungeonWeeks.size}`, title: `${ledger.dungeonWeeks.size} dungeon${ledger.dungeonWeeks.size > 1 ? 's' : ''} cleared`, detail: 'Weekly instant dungeons conquered' });
  }

  const monthly = getMonthly(logs, today);
  if (monthly.unlocked) {
    out.push({ kind: 'monthly', key: `monthly:${today.slice(0, 7)}`, title: 'Monarch of Gravity', detail: '30 quests cleared in one month' });
  }

  const skills = getSkillState(logs, templates);
  for (const tree of SKILL_TREES) {
    const top = [...tree.nodes].reverse().find((n) => skills.unlocked[n.id]);
    if (top) out.push({ kind: 'skill', key: `skill:${top.id}`, title: `Unlocked ${top.label}`, detail: `${tree.name} skill tree` });
  }

  const todayLog = logs[today];
  if (isComplete(todayLog)) {
    out.push({
      kind: 'quest',
      key: `quest:${today}`,
      title: todayLog!.penaltyAttempt ? 'Penalty quest survived' : 'Daily quest cleared',
      detail: todayLog!.dailyQuest!.tasks.map((t) => `${t.target} ${t.unit} ${t.label}`).join(' · '),
    });
  }
  return out;
}
