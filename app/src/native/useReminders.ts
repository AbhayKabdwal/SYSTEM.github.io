import { useCallback, useEffect, useState } from 'react';
import { createRepo } from '../data/repo';
import { DEFAULT_REMINDERS, reminderPermission, REMINDERS_KEY, requestReminderPermission, scheduleReminders, type ReminderSettings } from './reminders';
import { isNative } from './platform';
import type { Ledger } from '../domain';

const repo = createRepo();
const listeners = new Set<(s: ReminderSettings) => void>();

/** Reminder settings for this device, shared between the settings card and the scheduler. */
export function useReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  useEffect(() => {
    void repo.getSetting<ReminderSettings>(REMINDERS_KEY).then((s) => setSettings({ ...DEFAULT_REMINDERS, ...s }));
    listeners.add(setSettings);
    return () => void listeners.delete(setSettings);
  }, []);
  const save = useCallback(async (next: ReminderSettings) => {
    await repo.putSetting(REMINDERS_KEY, next);
    for (const l of listeners) l(next);
  }, []);
  return { settings, save };
}

const ASKED_KEY = 'remindersAsked';

/**
 * Reminders are on by default, but Android 13+ shows nothing until the app has asked
 * for permission. Ask once, on first launch, then leave it to the settings card.
 */
async function askOnce() {
  if ((await repo.getSetting<boolean>(ASKED_KEY)) || (await reminderPermission()) !== 'prompt') return;
  await repo.putSetting(ASKED_KEY, true);
  await requestReminderPermission();
}

/** Keeps the phone's scheduled reminders in step with today's progress. */
export function useReminderScheduler(ledger: Ledger, today: string) {
  const { settings } = useReminderSettings();
  const status = ledger.days[today]?.status;
  useEffect(() => {
    if (!isNative || !settings) return;
    const t = setTimeout(async () => {
      if (settings.enabled) await askOnce().catch(() => undefined);
      void scheduleReminders(settings, {
        today,
        todayDone: status === 'verified' || status === 'rest',
        streak: ledger.streak,
        penaltyToday: ledger.penaltyToday,
      }).catch(() => undefined);
    }, 1000);
    return () => clearTimeout(t);
  }, [settings, today, status, ledger.streak, ledger.penaltyToday]);
}
