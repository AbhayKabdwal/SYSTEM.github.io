import { useState } from 'react';
import { requestReminderPermission } from '../../native/reminders';
import { useReminderSettings } from '../../native/useReminders';
import { Card, ErrorText, Sec } from '../../ui/components';
import { toast } from '../../ui/notify';

/** Android only: when the System nudges you. */
export function RemindersCard() {
  const { settings, save } = useReminderSettings();
  const [error, setError] = useState<string | null>(null);
  if (!settings) return null;

  const enable = async (on: boolean) => {
    setError(null);
    if (on && !(await requestReminderPermission())) {
      setError('Notifications are blocked. Allow them for SYSTEM in Android Settings → Apps → SYSTEM → Notifications.');
      return;
    }
    await save({ ...settings, enabled: on });
    toast(on ? 'REMINDERS ON' : 'REMINDERS OFF');
  };

  return (
    <Card>
      <Sec>REMINDERS</Sec>
      <label className="check">
        <input type="checkbox" checked={settings.enabled} onChange={(e) => void enable(e.target.checked)} />
        <span>
          <span className="list-title">Quest reminders</span>
          <span className="hint" style={{ display: 'block' }}>
            A morning "quest has arrived" and an evening "streak at risk" if today isn't cleared. Works offline.
          </span>
        </span>
      </label>
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
      <ErrorText error={error} />
    </Card>
  );
}
