import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { cloudEnabled } from '../../cloud/client';
import { useApp } from '../../state/store';
import { ErrorText } from '../../ui/components';
import { systemAlert } from '../../ui/notify';
import { todayStr } from '../../domain';
import { Calibration } from './Calibration';

export function SetupPage() {
  const { setPlayer, importBackup } = useApp();
  const [name, setName] = useState('');
  const [step, setStep] = useState<'name' | 'calibrate'>('name');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) setStep('calibrate');
  };

  if (step === 'calibrate') {
    const n = name.trim().toUpperCase();
    return (
      <div className="splash" style={{ justifyContent: 'flex-start', overflowY: 'auto' }}>
        <div className="setup-box">
          <div className="setup-head">
            <div className="label" style={{ color: 'var(--glow)', letterSpacing: 4 }}>
              ▲ SYSTEM CALIBRATION ▲
            </div>
            <h1>{n}</h1>
            <p className="prose muted" style={{ marginTop: 8 }}>
              Answer honestly. The System builds your quests from this and raises the difficulty as you rank up.
            </p>
          </div>
          <Calibration
            submitLabel="◆ ACCEPT THE SYSTEM ◆"
            onSubmit={async (prefs) => {
              await setPlayer({ name: n, createdAt: new Date().toISOString(), waterTarget: 8, prefs, rulesSince: todayStr() });
              systemAlert(`WELCOME TO THE SYSTEM\n${n}\nClear your daily quest and attach proof every day. Missing a day has a penalty.`);
            }}
          />
          <button type="button" className="link-btn" style={{ marginTop: 12 }} onClick={() => setStep('name')}>
            ← back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="splash">
      <form className="setup-box" onSubmit={submit}>
        <div className="setup-head">
          <div className="label" style={{ color: 'var(--glow)', letterSpacing: 4 }}>
            ▲ SYSTEM INITIALIZATION ▲
          </div>
          <h1>WELCOME, HUNTER</h1>
          <p className="prose muted" style={{ marginTop: 8 }}>
            The System has detected your presence. Register to begin your ascent.
          </p>
        </div>
        <label className="label" htmlFor="setup-name">
          HUNTER NAME
        </label>
        <input id="setup-name" className="inp name-inp" placeholder="YOUR NAME…" autoComplete="off" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <button className="btn btn-grn" style={{ marginTop: 12, padding: 14 }} disabled={!name.trim()}>
          NEXT: CALIBRATION ▸
        </button>
        <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>
          Your data stays on this device. No account needed.
        </p>

        <div className="btn-row" style={{ marginTop: 18 }}>
          {cloudEnabled && (
            <Link className="btn btn-sm" to="/account">
              RESTORE FROM ACCOUNT
            </Link>
          )}
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            RESTORE FROM BACKUP
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              await importBackup(JSON.parse(await f.text()));
              if (!useApp.getState().player) setError('Backup restored, but it has no hunter name. Enter one above.');
              else systemAlert('BACKUP RESTORED');
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
        <ErrorText error={error} />
      </form>
    </div>
  );
}
