import { useEffect, useState } from 'react';
import { reminderPermission, requestReminderPermission, sendTestReminder, type PermissionState } from '../../native/reminders';
import { useReminderSettings } from '../../native/useReminders';
import { Card, ErrorText, Sec } from '../../ui/components';
import { toast } from '../../ui/notify';

const BLOCKED = 'Notifications are blocked for SYSTEM. Open Android Settings → Apps → SYSTEM → Notifications and turn them on, then come back.';

/** Android only: when the System nudges you. */
export function RemindersCard() {
  const { settings, save } = useReminderSettings();
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-check when returning from Android settings.
  useEffect(() => {
    const check = () => void reminderPermission().then(setPerm);
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  if (!settings) return null;

  const ensurePermission = async () => {
    if (perm === 'granted') return true;
    const ok = await requestReminderPermission();
    setPerm(ok ? 'granted' : 'denied');
    if (!ok) setError(BLOCKED);
    return ok;
  };

  const enable = async (on: boolean) => {
    setError(null);
    if (on && !(await ensurePermission())) return;
    await save({ ...settings, enabled: on });
    toast(on ? 'REMINDERS ON' : 'REMINDERS OFF');
  };

  return (
    <Card>
      <Sec>REMINDERS</Sec>
      <label className="check">
        <input type="checkbox" checked={settings.enabled && perm === 'granted'} onChange={(e) => void enable(e.target.checked)} />
        <span>
          <span className="list-title">Quest reminders</span>
          <span className="hint" style={{ display: 'block' }}>
            A morning "quest has arrived" and an evening "streak at risk" if today isn't cleared. Works offline.
          </span>
        </span>
      </label>
      {settings.enabled && perm !== 'granted' && (
        <p className="hint" style={{ color: 'var(--gold)' }}>
          {perm === 'denied' ? BLOCKED : 'Allow notifications to get reminders.'}{' '}
          {perm !== 'denied' && (
            <button className="link-btn" onClick={() => void ensurePermission()}>
              Allow
            </button>
          )}
        </p>
      )}
      {settings.enabled && (
        <div className="rec-grid" style={{ marginTop: 10 }}>
          <label className="label">
            QUEST ARRIVES
            <input className="inp" type="time" value={settings.morning} onChange={(e) => e.target.value && void save({ ...settings, morning: e.target.value })} />
          </label>
          <label className="label">
            STREAK WARNING
            <input className="inp" type="time" value={settings.evening} onChange={(e) => e.target.value && void save({ ...settings, evening: e.target.value })} />
          </label>
        </div>
      )}
      <button
        className="btn btn-sm"
        style={{ marginTop: 10 }}
        onClick={async () => {
          setError(null);
          if (!(await ensurePermission())) return;
          await sendTestReminder();
          toast('TEST NOTIFICATION IN 3 SECONDS');
        }}
      >
        SEND A TEST NOTIFICATION
      </button>
      <ErrorText error={error} />
    </Card>
  );
}
