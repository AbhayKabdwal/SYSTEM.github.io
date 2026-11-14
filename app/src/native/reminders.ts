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
const CHANNEL = 'quests';

export interface ReminderContext {
  today: DateStr;
  /** Today's quest is already done (or it's a rest day): skip today's evening warning. */
  todayDone: boolean;
  streak: number;
  penaltyToday: boolean;
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
    if (morning > now) {
      out.push({
        id: ID_BASE + i * 2,
        title: i === 0 && ctx.penaltyToday ? '⚠ PENALTY ZONE' : '[DAILY QUEST HAS ARRIVED]',
        body:
          i === 0 && ctx.penaltyToday
            ? 'You failed yesterday. Clear the penalty quest with proof to restore your streak.'
            : 'Your daily quest is ready. Clear it and attach proof.',
        at: morning,
      });
    }
    if (evening > now && !(i === 0 && ctx.todayDone)) {
      out.push({
        id: ID_BASE + i * 2 + 1,
        title: 'STREAK AT RISK',
        body: i === 0 && ctx.streak > 0 ? `Your ${ctx.streak}-day streak ends at midnight. Clear today's quest.` : "Today's quest isn't cleared yet. Missing it costs EXP.",
        at: evening,
      });
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
    notifications: items.map((n) => ({ id: n.id, title: n.title, body: n.body, channelId: CHANNEL, schedule: { at: n.at, allowWhileIdle: true } })),
  });
}

async function ensureChannel() {
  if (channelReady) return;
  await LocalNotifications.createChannel({ id: CHANNEL, name: 'Daily quests', description: 'Quest arrivals and streak warnings', importance: 4 });
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
        title: '[SYSTEM TEST]',
        body: 'Notifications are working. The System will remind you of your daily quest.',
        channelId: CHANNEL,
        schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
      },
    ],
  });
}
