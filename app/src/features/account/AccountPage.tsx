import { useEffect, useState, type FormEvent } from 'react';
import { cloudEnabled } from '../../cloud/client';
import { deleteAccount, handleAvailable, HANDLE_RE, passwordProblem, sendPasswordReset, signIn, signOut, signUp, updatePassword } from '../../cloud/auth';
import { blockedProfiles, unblock, updateProfile, type Profile } from '../../cloud/social';
import { useSession } from '../../state/session';
import { Card, Dialog, ErrorText, Field, Sec, Seg } from '../../ui/components';
import { systemAlert, toast } from '../../ui/notify';
import { timeAgo } from '../../ui/hooks';

const MIN_PASSPHRASE = 12;

/** Runs an async form action with busy/error state. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function friendly(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first: check your inbox for the link.';
  if (/already registered/i.test(msg)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a minute and try again.';
  if (/failed to fetch|network/i.test(msg)) return 'Network error. Check your connection.';
  return msg;
}

export function AccountPage() {
  const s = useSession();
  if (!cloudEnabled) {
    return (
      <div className="page">
        <Card>
          <Sec>ACCOUNT</Sec>
          <p className="prose">This build runs fully offline. Accounts, encrypted sync and the Hunters network are not configured.</p>
          <p className="prose">Everything you log stays in this browser. Use Vault → Export for backups.</p>
        </Card>
      </div>
    );
  }
  if (s.passwordRecovery) return <NewPassword />;
  if (!s.user) return <SignedOut />;
  return <SignedIn />;
}

function SignedOut() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  return (
    <div className="page">
      <Card>
        <Seg
          label="Account"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'in', label: 'SIGN IN' },
            { value: 'up', label: 'SIGN UP' },
            { value: 'reset', label: 'RESET PASSWORD' },
          ]}
        />
        {mode === 'in' && <SignInForm />}
        {mode === 'up' && <SignUpForm onDone={() => setMode('in')} />}
        {mode === 'reset' && <ResetForm />}
      </Card>
      <Card>
        <Sec>WHY AN ACCOUNT</Sec>
        <p className="prose">
          An account lets you sync between devices and join the Hunters network. Your training data is <strong>end-to-end encrypted</strong> with a
          vault passphrase only you know. The server stores ciphertext it cannot read.
        </p>
        <p className="prose">Progress photos never leave your device.</p>
      </Card>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  return (
    <form onSubmit={run(() => signIn(email.trim(), password))}>
      <Field label="EMAIL">{(id) => <input id={id} className="inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="PASSWORD">
        {(id) => <input id={id} className="inp" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <button className="btn btn-grn" disabled={busy}>
        {busy ? 'SIGNING IN…' : 'SIGN IN'}
      </button>
      <ErrorText error={error} />
    </form>
  );
}

function SignUpForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const { busy, error, setError, run } = useAction();
  const h = handle.toLowerCase();

  const submit = run(async () => {
    if (!HANDLE_RE.test(h)) throw new Error('Handle: 3–20 characters, lowercase letters, numbers or _.');
    const pwErr = passwordProblem(password);
    if (pwErr) throw new Error(pwErr);
    if (password !== confirmPw) throw new Error('Passwords do not match.');
    if (!(await handleAvailable(h))) throw new Error(`@${h} is taken.`);
    const { signedIn } = await signUp(email.trim(), password, h, name.trim() || h);
    if (!signedIn) {
      systemAlert('CHECK YOUR EMAIL\nCONFIRM TO ACTIVATE');
      onDone();
    }
  });

  return (
    <form onSubmit={submit}>
      <Field label="EMAIL">{(id) => <input id={id} className="inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="HANDLE" hint="Public. Others find and follow you by it.">
        {(id) => (
          <input
            id={id}
            className="inp"
            autoComplete="username"
            required
            maxLength={20}
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''));
              setError(null);
            }}
          />
        )}
      </Field>
      <Field label="DISPLAY NAME">{(id) => <input id={id} className="inp" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="PASSWORD" hint={`At least 10 characters, letters plus numbers or symbols.`}>
        {(id) => <input id={id} className="inp" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Field label="CONFIRM PASSWORD">
        {(id) => <input id={id} className="inp" type="password" autoComplete="new-password" required value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />}
      </Field>
      <button className="btn btn-grn" disabled={busy}>
        {busy ? 'CREATING…' : 'CREATE ACCOUNT'}
      </button>
      <ErrorText error={error} />
    </form>
  );
}

function ResetForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();
  if (sent) return <p className="prose">If an account exists for {email}, a reset link is on its way.</p>;
  return (
    <form
      onSubmit={run(async () => {
        await sendPasswordReset(email.trim());
        setSent(true);
      })}
    >
      <Field label="EMAIL">{(id) => <input id={id} className="inp" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <button className="btn" disabled={busy}>
        SEND RESET LINK
      </button>
      <ErrorText error={error} />
      <p className="hint">This resets your account password only. Your vault passphrase is separate and cannot be reset by email.</p>
    </form>
  );
}

function NewPassword() {
  const clear = useSession((s) => s.clearPasswordRecovery);
  const [pw, setPw] = useState('');
  const { busy, error, run } = useAction();
  return (
    <div className="page">
      <Card>
        <Sec>SET A NEW PASSWORD</Sec>
        <form
          onSubmit={run(async () => {
            const p = passwordProblem(pw);
            if (p) throw new Error(p);
            await updatePassword(pw);
            clear();
            toast('PASSWORD UPDATED');
          })}
        >
          <Field label="NEW PASSWORD">{(id) => <input id={id} className="inp" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
          <button className="btn btn-grn" disabled={busy}>
            SAVE PASSWORD
          </button>
          <ErrorText error={error} />
        </form>
      </Card>
    </div>
  );
}

function SignedIn() {
  const s = useSession();
  return (
    <div className="page">
      <Card>
        <Sec>ACCOUNT</Sec>
        <div className="kv">
          <span>Email</span>
          <span style={{ overflowWrap: 'anywhere' }}>{s.user!.email}</span>
        </div>
        {s.profile && (
          <div className="kv">
            <span>Handle</span>
            <span>@{s.profile.handle}</span>
          </div>
        )}
      </Card>

      {s.vault === 'checking' && (
        <Card>
          <p className="prose">Checking vault…</p>
        </Card>
      )}
      {s.vault === 'new' && <VaultSetup />}
      {s.vault === 'locked' && <VaultUnlock />}
      {s.vault === 'unlocked' && <VaultStatusCard />}

      {s.profile && <ProfileEditor />}
      <BlockedList />
      <AccountActions />
    </div>
  );
}

function PassphraseFields({ value, onChange, confirmValue, onConfirm, label = 'VAULT PASSPHRASE' }: { value: string; onChange: (v: string) => void; confirmValue: string; onConfirm: (v: string) => void; label?: string }) {
  return (
    <>
      <Field label={label} hint={`At least ${MIN_PASSPHRASE} characters. A few random words works well. Use something different from your account password.`}>
        {(id) => <input id={id} className="inp" type="password" autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} />}
      </Field>
      <Field label="CONFIRM PASSPHRASE">{(id) => <input id={id} className="inp" type="password" autoComplete="new-password" value={confirmValue} onChange={(e) => onConfirm(e.target.value)} />}</Field>
    </>
  );
}

function checkPassphrase(p: string, c: string) {
  if (p.length < MIN_PASSPHRASE) throw new Error(`Use at least ${MIN_PASSPHRASE} characters.`);
  if (p !== c) throw new Error('Passphrases do not match.');
}

function RecoveryCodeDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <Dialog title="YOUR RECOVERY CODE" onClose={() => saved && onClose()}>
      <p className="prose">
        This is the <strong>only</strong> way back into your vault if you forget the passphrase. It is shown once. Write it down or store it in a
        password manager.
      </p>
      <div className="code-box" style={{ margin: '14px 0' }}>
        {code}
      </div>
      <button
        className="btn btn-sm"
        onClick={() =>
          navigator.clipboard?.writeText(code).then(
            () => toast('COPIED'),
            () => toast('COPY FAILED'),
          )
        }
      >
        COPY
      </button>
      <label className="check" style={{ margin: '14px 0' }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have stored this code somewhere safe
      </label>
      <button className="btn btn-grn" disabled={!saved} onClick={onClose}>
        DONE
      </button>
    </Dialog>
  );
}

function VaultSetup() {
  const setupVault = useSession((s) => s.setupVault);
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  return (
    <Card>
      <Sec>CREATE YOUR VAULT</Sec>
      <p className="prose" style={{ marginBottom: 12 }}>
        Your logs are encrypted on this device before upload. Pick a vault passphrase: you'll enter it once on each new device.
      </p>
      <form
        onSubmit={run(async () => {
          checkPassphrase(p, c);
          setCode(await setupVault(p));
        })}
      >
        <PassphraseFields value={p} onChange={setP} confirmValue={c} onConfirm={setC} />
        <button className="btn btn-grn" disabled={busy}>
          {busy ? 'ENCRYPTING…' : 'CREATE VAULT'}
        </button>
        <ErrorText error={error} />
      </form>
      {code && <RecoveryCodeDialog code={code} onClose={() => setCode(null)} />}
    </Card>
  );
}

function VaultUnlock() {
  const { unlock, recover } = useSession();
  const [mode, setMode] = useState<'pass' | 'code'>('pass');
  const [p, setP] = useState('');
  const [rc, setRc] = useState('');
  const [np, setNp] = useState('');
  const [nc, setNc] = useState('');
  const [newCode, setNewCode] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  return (
    <Card>
      <Sec>UNLOCK VAULT ON THIS DEVICE</Sec>
      <Seg
        label="Unlock method"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'pass', label: 'PASSPHRASE' },
          { value: 'code', label: 'RECOVERY CODE' },
        ]}
      />
      {mode === 'pass' ? (
        <form onSubmit={run(() => unlock(p))}>
          <Field label="VAULT PASSPHRASE">{(id) => <input id={id} className="inp" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} />}</Field>
          <button className="btn btn-grn" disabled={busy || !p}>
            {busy ? 'UNLOCKING…' : 'UNLOCK'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={run(async () => {
            checkPassphrase(np, nc);
            setNewCode(await recover(rc, np));
          })}
        >
          <Field label="RECOVERY CODE">{(id) => <input id={id} className="inp" autoComplete="off" spellCheck={false} value={rc} onChange={(e) => setRc(e.target.value)} />}</Field>
          <PassphraseFields label="NEW VAULT PASSPHRASE" value={np} onChange={setNp} confirmValue={nc} onConfirm={setNc} />
          <button className="btn btn-gold" disabled={busy || !rc}>
            {busy ? 'RECOVERING…' : 'RECOVER VAULT'}
          </button>
          <p className="hint">Your old recovery code stops working; you'll get a new one.</p>
        </form>
      )}
      <ErrorText error={error} />
      {newCode && <RecoveryCodeDialog code={newCode} onClose={() => setNewCode(null)} />}
    </Card>
  );
}

function VaultStatusCard() {
  const s = useSession();
  const [dialog, setDialog] = useState<'pass' | 'code' | null>(null);
  const color = s.sync === 'error' ? 'var(--red)' : s.sync === 'syncing' ? 'var(--gold)' : s.sync === 'offline' ? 'var(--dim)' : 'var(--grn)';
  return (
    <Card>
      <Sec>ENCRYPTED SYNC</Sec>
      <div className="kv">
        <span>Status</span>
        <span>
          <i className="sync-dot" style={{ background: color }} />
          {s.sync === 'idle' ? 'Up to date' : s.sync === 'syncing' ? 'Syncing…' : s.sync === 'offline' ? 'Offline' : 'Error'}
        </span>
      </div>
      <div className="kv">
        <span>Last synced</span>
        <span>{s.lastSyncedAt ? timeAgo(s.lastSyncedAt) : '—'}</span>
      </div>
      <ErrorText error={s.sync === 'error' ? s.syncError : null} />
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-sm" disabled={s.sync === 'syncing'} onClick={() => void s.syncNow()}>
          SYNC NOW
        </button>
        <button className="btn btn-sm" onClick={() => setDialog('pass')}>
          CHANGE PASSPHRASE
        </button>
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn btn-sm" onClick={() => setDialog('code')}>
          NEW RECOVERY CODE
        </button>
        <button
          className="btn btn-sm btn-red"
          onClick={() => confirm('Remove the vault key from this device? You will need the passphrase to sync here again.') && void s.forgetDevice()}
        >
          LOCK THIS DEVICE
        </button>
      </div>
      {dialog === 'pass' && <ChangePassphrase onClose={() => setDialog(null)} />}
      {dialog === 'code' && <NewRecoveryCode onClose={() => setDialog(null)} />}
    </Card>
  );
}

function ChangePassphrase({ onClose }: { onClose: () => void }) {
  const change = useSession((s) => s.changePassphrase);
  const [cur, setCur] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Dialog title="CHANGE VAULT PASSPHRASE" onClose={onClose}>
      <form
        onSubmit={run(async () => {
          checkPassphrase(p, c);
          await change(cur, p);
          toast('PASSPHRASE CHANGED');
          onClose();
        })}
      >
        <Field label="CURRENT PASSPHRASE">{(id) => <input id={id} className="inp" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />}</Field>
        <PassphraseFields label="NEW PASSPHRASE" value={p} onChange={setP} confirmValue={c} onConfirm={setC} />
        <div className="btn-row">
          <button type="button" className="btn" onClick={onClose}>
            CANCEL
          </button>
          <button className="btn btn-grn" disabled={busy}>
            {busy ? 'WORKING…' : 'CHANGE'}
          </button>
        </div>
        <ErrorText error={error} />
      </form>
    </Dialog>
  );
}

function NewRecoveryCode({ onClose }: { onClose: () => void }) {
  const rotate = useSession((s) => s.newRecoveryCode);
  const [p, setP] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  if (code) return <RecoveryCodeDialog code={code} onClose={onClose} />;
  return (
    <Dialog title="NEW RECOVERY CODE" onClose={onClose}>
      <p className="prose" style={{ marginBottom: 12 }}>
        Your current recovery code will stop working.
      </p>
      <form onSubmit={run(async () => setCode(await rotate(p)))}>
        <Field label="VAULT PASSPHRASE">{(id) => <input id={id} className="inp" type="password" value={p} onChange={(e) => setP(e.target.value)} />}</Field>
        <button className="btn btn-gold" disabled={busy || !p}>
          GENERATE
        </button>
        <ErrorText error={error} />
      </form>
    </Dialog>
  );
}

function ProfileEditor() {
  const { profile, user, refreshProfile } = useSession();
  const [name, setName] = useState(profile!.display_name);
  const [bio, setBio] = useState(profile!.bio);
  const { busy, error, run } = useAction();
  return (
    <Card>
      <Sec>PUBLIC PROFILE</Sec>
      <form
        onSubmit={run(async () => {
          await updateProfile(user!.id, { display_name: name.trim() || profile!.handle, bio: bio.trim() });
          await refreshProfile();
          toast('PROFILE SAVED');
        })}
      >
        <Field label="DISPLAY NAME">{(id) => <input id={id} className="inp" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="BIO" hint={`${bio.length}/160 · visible to signed-in hunters`}>
          {(id) => <textarea id={id} className="inp" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} />}
        </Field>
        <button className="btn btn-sm" disabled={busy}>
          SAVE PROFILE
        </button>
        <ErrorText error={error} />
      </form>
    </Card>
  );
}

function BlockedList() {
  const me = useSession((s) => s.user!.id);
  const [list, setList] = useState<Profile[] | null>(null);
  useEffect(() => {
    blockedProfiles(me).then(setList, () => setList([]));
  }, [me]);
  if (!list?.length) return null;
  return (
    <Card>
      <Sec>BLOCKED HUNTERS</Sec>
      {list.map((p) => (
        <div key={p.id} className="row" style={{ padding: '6px 0' }}>
          <span>
            {p.display_name} <span className="muted">@{p.handle}</span>
          </span>
          <button
            className="btn btn-sm"
            onClick={async () => {
              await unblock(me, p.id);
              setList((l) => l!.filter((x) => x.id !== p.id));
              toast('UNBLOCKED');
            }}
          >
            UNBLOCK
          </button>
        </div>
      ))}
    </Card>
  );
}

function AccountActions() {
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Card>
      <Sec>SECURITY</Sec>
      <div className="stack">
        <button className="btn" onClick={() => setPwOpen(true)}>
          CHANGE ACCOUNT PASSWORD
        </button>
        <button className="btn" onClick={() => void signOut()}>
          SIGN OUT
        </button>
        <button
          className="btn btn-red"
          disabled={busy}
          onClick={run(async () => {
            if (!confirm('Permanently delete your account, encrypted vault, profile and feats? Data on this device stays.')) return;
            if (prompt('Type DELETE to confirm') !== 'DELETE') return;
            await deleteAccount();
            systemAlert('ACCOUNT DELETED');
          })}
        >
          DELETE ACCOUNT
        </button>
      </div>
      <ErrorText error={error} />
      {pwOpen && (
        <Dialog title="CHANGE ACCOUNT PASSWORD" onClose={() => setPwOpen(false)}>
          <form
            onSubmit={run(async () => {
              const p = passwordProblem(pw);
              if (p) throw new Error(p);
              await updatePassword(pw);
              toast('PASSWORD UPDATED');
              setPwOpen(false);
            })}
          >
            <Field label="NEW PASSWORD">{(id) => <input id={id} className="inp" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
            <button className="btn btn-grn" disabled={busy}>
              SAVE
            </button>
            <ErrorText error={error} />
          </form>
        </Dialog>
      )}
    </Card>
  );
}
