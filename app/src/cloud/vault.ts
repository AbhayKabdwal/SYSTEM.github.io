import type { AppData, MetaStamps } from '../data/repo';
import { mergeLogs } from '../data/backup';
import { open, seal, type VaultKeyRecord } from '../data/crypto';
import type { Logs } from '../domain';
import { requireClient } from './client';

/** What gets encrypted and synced. Photo files travel separately (media.ts); logs keep their ids. */
export interface Snapshot {
  v: 1;
  data: AppData;
  stamps: MetaStamps;
}

export function toSnapshot(data: AppData, stamps: MetaStamps): Snapshot {
  const logs: Logs = {};
  for (const [d, l] of Object.entries(data.logs)) {
    // v1 inline data-URL photos are never synced; photo files go through encrypted media sync.
    const { photos: _photos, ...rest } = l;
    logs[d] = rest;
  }
  return { v: 1, data: { ...data, logs }, stamps };
}

/**
 * Logs: newest save per date wins. Settings: newest stamp per key wins.
 * Local photo ids are kept on whichever log version ends up winning.
 */
export function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
  const logs = mergeLogs(local.data.logs, remote.data.logs);
  const data: AppData = { ...local.data, logs };
  const stamps: MetaStamps = { ...local.stamps };
  for (const k of ['player', 'templates', 'questPool'] as const) {
    const r = remote.stamps[k];
    if (r && (!stamps[k] || r > stamps[k]!)) {
      (data as unknown as Record<string, unknown>)[k] = remote.data[k];
      stamps[k] = r;
    }
  }
  return { v: 1, data, stamps };
}

/** Snapshots from older app versions had no photo ids; keep this device's ids rather than lose them. */
export function withLocalPhotos(merged: AppData, localLogs: Logs): AppData {
  const logs: Logs = {};
  for (const [d, l] of Object.entries(merged.logs)) {
    const ids = localLogs[d]?.photoIds;
    logs[d] = ids && !l.photoIds ? { ...l, photoIds: ids } : l;
  }
  return { ...merged, logs };
}

/** Key-order independent JSON, so "nothing changed" is detected reliably. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export async function fetchKeyRecord(userId: string): Promise<VaultKeyRecord | null> {
  const { data, error } = await requireClient()
    .from('vault_keys')
    .select('kdf_iterations, pass_salt, pass_iv, pass_wrapped, rec_salt, rec_iv, rec_wrapped')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as VaultKeyRecord | null;
}

export async function saveKeyRecord(userId: string, record: VaultKeyRecord) {
  const { error } = await requireClient()
    .from('vault_keys')
    .upsert({ user_id: userId, ...record, updated_at: new Date().toISOString() });
  if (error) throw error;
}

const MAX_ATTEMPTS = 4;

/**
 * Pull, merge, push with optimistic concurrency on `version`.
 * Returns the merged snapshot the caller should apply locally.
 */
export async function syncVault(userId: string, key: CryptoKey, local: Snapshot): Promise<Snapshot> {
  const sb = requireClient();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: row, error } = await sb.from('vaults').select('version, iv, ciphertext').eq('user_id', userId).maybeSingle();
    if (error) throw error;

    let merged = local;
    if (row) {
      const remote = await open<Snapshot>(key, { iv: row.iv, ciphertext: row.ciphertext });
      merged = mergeSnapshots(local, remote);
      if (stableStringify(merged) === stableStringify(remote)) return merged;
    }

    const sealed = await seal(key, merged);
    if (!row) {
      const { error: insErr } = await sb.from('vaults').insert({ user_id: userId, version: 1, ...sealed });
      if (!insErr) return merged;
      if (insErr.code === '23505') continue; // another device created it first
      throw insErr;
    }
    const { data: updated, error: upErr } = await sb
      .from('vaults')
      .update({ ...sealed, version: row.version + 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('version', row.version)
      .select('version');
    if (upErr) throw upErr;
    if (updated?.length) return merged;
    // Someone else pushed between our read and write: go round again.
  }
  throw new Error('Sync conflict did not settle. Try again.');
}
