import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../cloud/client';
import { fetchKeyRecord, saveKeyRecord, syncVault, toSnapshot, withLocalPhotos } from '../cloud/vault';
import { myProfile, type Profile } from '../cloud/social';
import { syncPhotos } from '../cloud/media';
import {
  createVaultKeys,
  rewrapWithPassphrase,
  rotateRecoveryCode,
  toDeviceKey,
  unlockWithPassphrase,
  unlockWithRecovery,
  type VaultKeyRecord,
} from '../data/crypto';
import { createRepo } from '../data/repo';
import { useApp } from './store';

/**
 * none:      signed out (or cloud not configured)
 * new:       signed in, no vault yet: user must pick a passphrase
 * locked:    vault exists, this device has no key: user must enter the passphrase
 * unlocked:  key on device, syncing
 */
export type VaultStatus = 'none' | 'checking' | 'new' | 'locked' | 'unlocked';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface DeviceKey {
  userId: string;
  key: CryptoKey;
}

const DEVICE_KEY = 'vaultDeviceKey';
/** Account whose vault this device's data belongs to. */
const DATA_OWNER = 'dataOwner';
const SYNC_DEBOUNCE_MS = 2500;
const repo = createRepo();

interface SessionState {
  user: User | null;
  profile: Profile | null;
  vault: VaultStatus;
  sync: SyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  /** Bumped when synced photos arrive, so open images re-read the photo store. */
  photoRev: number;
  /** Set after a password-reset email link; the UI must ask for a new password. */
  passwordRecovery: boolean;
  start(): void;
  refreshProfile(): Promise<void>;
  setupVault(passphrase: string): Promise<string>;
  unlock(passphrase: string): Promise<void>;
  recover(code: string, newPassphrase: string): Promise<string>;
  changePassphrase(current: string, next: string): Promise<void>;
  newRecoveryCode(passphrase: string): Promise<string>;
  forgetDevice(): Promise<void>;
  syncNow(): Promise<void>;
  clearPasswordRecovery(): void;
}

let deviceKey: CryptoKey | null = null;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let syncing: Promise<void> | null = null;
let started = false;

export const useSession = create<SessionState>((set, get) => {
  const userId = () => get().user?.id;

  const storeDeviceKey = async (uid: string, key: CryptoKey) => {
    await repo.putSetting(DATA_OWNER, uid);
    deviceKey = await toDeviceKey(key);
    await repo.putSetting(DEVICE_KEY, { userId: uid, key: deviceKey } satisfies DeviceKey);
    set({ vault: 'unlocked' });
    void get().syncNow();
  };

  // Without this, a second person signing in on a shared device would merge the first
  // person's logs into their own vault.
  const assertOwner = async () => {
    const owner = await repo.getSetting<string>(DATA_OWNER);
    if (owner && owner !== userId()) {
      throw new Error('This device holds another account\'s data. Erase device data in the Vault before syncing a different account.');
    }
  };

  const requireRecord = async (): Promise<VaultKeyRecord> => {
    const rec = await fetchKeyRecord(userId()!);
    if (!rec) throw new Error('No vault exists for this account yet.');
    return rec;
  };

  const onUser = async (user: User | null) => {
    const prev = get().user?.id;
    set({ user });
    if (!user) {
      deviceKey = null;
      set({ profile: null, vault: 'none', sync: 'idle', lastSyncedAt: null });
      return;
    }
    if (prev === user.id && get().vault !== 'none') return;
    set({ vault: 'checking' });
    void get().refreshProfile();
    const cached = await repo.getSetting<DeviceKey>(DEVICE_KEY);
    if (cached?.userId === user.id && cached.key) {
      deviceKey = cached.key;
      set({ vault: 'unlocked' });
      void get().syncNow();
      return;
    }
    try {
      set({ vault: (await fetchKeyRecord(user.id)) ? 'locked' : 'new' });
    } catch (e) {
      set({ vault: 'locked', sync: 'error', syncError: (e as Error).message });
    }
  };

  return {
    user: null,
    profile: null,
    vault: 'none',
    sync: 'idle',
    lastSyncedAt: null,
    syncError: null,
    photoRev: 0,
    passwordRecovery: false,

    start() {
      if (started || !supabase) return;
      started = true;
      supabase.auth.getSession().then(({ data }) => onUser(data.session?.user ?? null));
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') set({ passwordRecovery: true });
        // Defer: supabase-js warns against awaiting its own calls inside this callback.
        setTimeout(() => void onUser(session?.user ?? null), 0);
      });
      // Push local changes shortly after they happen.
      useApp.subscribe((s, prev) => {
        if (s.revision === prev.revision || get().vault !== 'unlocked') return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => void get().syncNow(), SYNC_DEBOUNCE_MS);
      });
      window.addEventListener('online', () => void get().syncNow());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void get().syncNow();
      });
    },

    async refreshProfile() {
      const id = userId();
      if (!id) return;
      try {
        set({ profile: await myProfile(id) });
      } catch {
        /* profile is cosmetic here; feeds will surface real errors */
      }
    },

    async setupVault(passphrase) {
      const id = userId()!;
      await assertOwner();
      if (await fetchKeyRecord(id)) throw new Error('This account already has a vault. Unlock it instead.');
      const { dataKey, recoveryCode, record } = await createVaultKeys(passphrase);
      await saveKeyRecord(id, record);
      await storeDeviceKey(id, dataKey);
      return recoveryCode;
    },

    async unlock(passphrase) {
      await assertOwner();
      const key = await unlockWithPassphrase(await requireRecord(), passphrase);
      await storeDeviceKey(userId()!, key);
    },

    async recover(code, newPassphrase) {
      await assertOwner();
      const rec = await requireRecord();
      const key = await unlockWithRecovery(rec, code, true);
      // The used recovery code is replaced: treat it as spent.
      const withPass = await rewrapWithPassphrase(rec, key, newPassphrase);
      const { recoveryCode, record } = await rotateRecoveryCode(withPass, key);
      await saveKeyRecord(userId()!, record);
      await storeDeviceKey(userId()!, key);
      return recoveryCode;
    },

    async changePassphrase(current, next) {
      const rec = await requireRecord();
      const key = await unlockWithPassphrase(rec, current, true);
      await saveKeyRecord(userId()!, await rewrapWithPassphrase(rec, key, next));
    },

    async newRecoveryCode(passphrase) {
      const rec = await requireRecord();
      const key = await unlockWithPassphrase(rec, passphrase, true);
      const { recoveryCode, record } = await rotateRecoveryCode(rec, key);
      await saveKeyRecord(userId()!, record);
      return recoveryCode;
    },

    async forgetDevice() {
      deviceKey = null;
      await repo.putSetting(DEVICE_KEY, null);
      set({ vault: get().user ? 'locked' : 'none' });
    },

    async syncNow() {
      const id = userId();
      if (!id || !deviceKey || get().vault !== 'unlocked') return;
      if (!navigator.onLine) {
        set({ sync: 'offline' });
        return;
      }
      if (syncing) return syncing;
      syncing = (async () => {
        set({ sync: 'syncing', syncError: null });
        try {
          const app = useApp.getState();
          const local = toSnapshot({ player: app.player, templates: app.templates, questPool: app.questPool, logs: app.logs }, app.stamps);
          const merged = await syncVault(id, deviceKey!, local);
          // Re-read: the user may have saved something while we were on the network.
          const now = useApp.getState();
          if (now.revision === app.revision) {
            await now.applyRemote(withLocalPhotos(merged.data, now.logs), merged.stamps);
          } else {
            clearTimeout(syncTimer);
            syncTimer = setTimeout(() => void get().syncNow(), SYNC_DEBOUNCE_MS);
          }
          // Photos after logs: the vault now lists every photo any device references.
          const arrived = await syncPhotos(id, deviceKey!, useApp.getState().logs, repo);
          if (arrived) set((st) => ({ photoRev: st.photoRev + 1 }));
          set({ sync: 'idle', lastSyncedAt: new Date().toISOString() });
        } catch (e) {
          set({ sync: 'error', syncError: (e as Error).message });
        } finally {
          syncing = null;
        }
      })();
      return syncing;
    },

    clearPasswordRecovery() {
      set({ passwordRecovery: false });
    },
  };
});
