import { LocalNotifications } from '@capacitor/local-notifications';
import { addDays, parseDateStr, type DateStr } from '../domain';
import { isNative } from './platform';

/** Per-device: reminders belong to the phone, not the synced account. */
export interface ReminderSettings {
  enabled: boolean;
  /** "HH:MM", local time. */
  morning: string;
  evening: string;
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: true, morning: '08:00', evening: '20:30' };
export const REMINDERS_KEY = 'reminders';

/** Enough runway that reminders keep coming if the app isn't opened for a while. */
const DAYS_AHEAD = 14;
const ID_BASE = 7000;
// v2 adds the System chime. Android fixes a channel's sound when it's created, hence the new id.
const CHANNEL = 'quests_v2';
const OLD_CHANNELS = ['quests'];
const SOUND = 'system_chime.wav';

export interface ReminderContext {
  today: DateStr;
  /** Today's quest is already done (or it's a rest day): skip today's evening warning. */
  todayDone: boolean;
  streak: number;
  penaltyToday: boolean;
  /** Rank letter, for flavour. */
  rank?: string;
}

function pick<T>(items: T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return items[(h >>> 0) % items.length]!;
}

/** Morning: the quest arrives. Varies by day so it never reads the same twice in a row. */
export function morningText(date: DateStr, ctx: ReminderContext, isToday: boolean) {
  if (isToday && ctx.penaltyToday) {
    return {
      title: '⚠ [PENALTY ZONE]',
      body: pick(
        [
          "Yesterday's quest went unanswered. Survive today's penalty quest, with proof, and your streak returns.",
          'The System does not forget a missed day. Clear the penalty quest to win your streak back.',
          'You fell. Get up. Today\'s penalty quest is the way back.',
        ],
        date,
      ),
    };
  }
  const streak = isToday ? ctx.streak : 0;
  const rank = ctx.rank ?? 'E';
  const lines = [
    'A new quest has been assigned. Clear it and bring proof.',
    `${rank}-Rank hunters don't wait for motivation. Today's quest is ready.`,
    'Your strength does not grow on its own. The quest is waiting.',
    'The gate is open. Today\'s training has been assigned.',
    ...(streak >= 3 ? [`${streak} days unbroken. Make it ${streak + 1}.`, `🔥 ${streak}-day streak. The System expects day ${streak + 1}.`] : []),
  ];
  return { title: '[DAILY QUEST HAS ARRIVED]', body: pick(lines, `m:${date}`) };
}

/** Evening: only if the quest is still open. */
export function eveningText(date: DateStr, ctx: ReminderContext, isToday: boolean, hoursLeft: number) {
  const streak = isToday ? ctx.streak : 0;
  const h = Math.max(1, Math.round(hoursLeft));
  const lines =
    streak > 0
      ? [
          `${h} hours left. Your ${streak}-day streak ends at midnight unless you clear today's quest.`,
          `🔥 ${streak} days on the line. ${h} hours remain.`,
          `The System is counting down: ${h} hours to keep your ${streak}-day streak.`,
        ]
      : [`${h} hours until the day closes. An uncleared quest costs EXP.`, 'Quest incomplete. The penalty zone opens at midnight.', `Still time: ${h} hours. Clear the quest and start a streak.`];
  return { title: '[WARNING] QUEST INCOMPLETE', body: pick(lines, `e:${date}`) };
}

function at(date: DateStr, hhmm: string): Date {
  const d = parseDateStr(date);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d;
}

/** Pure, so the schedule is testable: what to post and when. */
export function plan(settings: ReminderSettings, ctx: ReminderContext, now: Date) {
  if (!settings.enabled) return [];
  const out: { id: number; title: string; body: string; at: Date }[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = addDays(ctx.today, i);
    const morning = at(d, settings.morning);
    const evening = at(d, settings.evening);
    if (morning > now) out.push({ id: ID_BASE + i * 2, ...morningText(d, ctx, i === 0), at: morning });
    if (evening > now && !(i === 0 && ctx.todayDone)) {
      const midnight = at(addDays(d, 1), '00:00');
      out.push({ id: ID_BASE + i * 2 + 1, ...eveningText(d, ctx, i === 0, (midnight.getTime() - evening.getTime()) / 3_600_000), at: evening });
    }
  }
  return out;
}

let channelReady = false;

/** Replaces every pending reminder with a fresh schedule. Safe to call often. */
export async function scheduleReminders(settings: ReminderSettings, ctx: ReminderContext) {
  if (!isNative) return;
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= ID_BASE && n.id < ID_BASE + DAYS_AHEAD * 2);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  const items = plan(settings, ctx, new Date());
  if (!items.length) return;
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return;
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: items.map((n) => ({ id: n.id, title: n.title, body: n.body, channelId: CHANNEL, sound: SOUND, schedule: { at: n.at, allowWhileIdle: true } })),
  });
}

async function ensureChannel() {
  if (channelReady) return;
  for (const id of OLD_CHANNELS) await LocalNotifications.deleteChannel({ id }).catch(() => undefined);
  await LocalNotifications.createChannel({ id: CHANNEL, name: 'Daily quests', description: 'Quest arrivals and streak warnings', importance: 4, sound: SOUND, vibration: true, lights: true, lightColor: '#00C8FF' });
  channelReady = true;
}

export type PermissionState = 'granted' | 'denied' | 'prompt';

export async function reminderPermission(): Promise<PermissionState> {
  if (!isNative) return 'denied';
  const p = (await LocalNotifications.checkPermissions()).display;
  return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';
}

/** Asks for notification permission (Android 13+ shows a prompt). */
export async function requestReminderPermission(): Promise<boolean> {
  if (!isNative) return false;
  const p = await LocalNotifications.requestPermissions();
  return p.display === 'granted';
}

/** Fires in a few seconds, so you can check notifications work on this phone. */
export async function sendTestReminder() {
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: ID_BASE - 1,
        title: '[SYSTEM] CONNECTION ESTABLISHED',
        body: 'Notifications are working. The System will find you when a quest arrives.',
        channelId: CHANNEL,
        sound: SOUND,
        schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
      },
    ],
  });
}
