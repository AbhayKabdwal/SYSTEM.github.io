import { SKILL_TREES } from './defaults';
import { getRank, getStreak, getMonthly, countCleared } from './progress';
import { EXP_PER_RANK_POINT, totalExp } from './exp';
import { getSkillState } from './skills';
import type { DateStr, Logs, Template } from './types';

export type AchievementKind = 'rank' | 'streak' | 'skill' | 'monthly' | 'milestone' | 'quest';

/** Something worth sharing. Only these fields ever leave the device, and only if the user posts it. */
export interface Achievement {
  kind: AchievementKind;
  key: string;
  title: string;
  detail: string;
}

const STREAK_MARKS = [3, 7, 14, 30, 60, 100, 200, 365];
const CLEARED_MARKS = [1, 10, 25, 50, 100, 200, 365, 500, 1000];

export function achievements(logs: Logs, templates: Template[], today: DateStr): Achievement[] {
  const out: Achievement[] = [];
  const rank = getRank(totalExp(logs, templates) / EXP_PER_RANK_POINT);
  out.push({
    kind: 'rank',
    key: `rank:${rank.level}`,
    title: `Reached ${rank.rank}-Rank`,
    detail: `LVL ${rank.level} — ${rank.title}`,
  });

  const streak = getStreak(logs, today);
  const streakMark = [...STREAK_MARKS].reverse().find((m) => streak >= m);
  if (streakMark) {
    out.push({ kind: 'streak', key: `streak:${streakMark}`, title: `${streakMark}-day streak`, detail: `${streak} days without missing a quest` });
  }

  const cleared = countCleared(logs);
  const clearedMark = [...CLEARED_MARKS].reverse().find((m) => cleared >= m);
  if (clearedMark) {
    out.push({ kind: 'milestone', key: `cleared:${clearedMark}`, title: `${clearedMark} quests cleared`, detail: `${cleared} daily quests cleared in total` });
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
  if (todayLog?.dailyQuest && todayLog.dailyQuest.tasks.every((t) => Number(todayLog.questProgress?.[t.id] ?? 0) >= t.target)) {
    out.push({
      kind: 'quest',
      key: `quest:${today}`,
      title: todayLog.penaltyAttempt ? 'Penalty quest survived' : 'Daily quest cleared',
      detail: todayLog.dailyQuest.tasks.map((t) => `${t.target} ${t.unit} ${t.label}`).join(' · '),
    });
  }
  return out;
}
