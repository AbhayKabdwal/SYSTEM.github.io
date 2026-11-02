import type { Logs } from '../domain';
import { openBytes, sealBytes } from '../data/crypto';
import type { Repo } from '../data/repo';
import { requireClient } from './client';

// Private photos (progress photos and Private proofs) are backed up encrypted with the
// vault key, so they reappear in the archive on your other devices. Only ciphertext
// reaches the server, in a bucket only you can read.

const BUCKET = 'vault-media';
const PAGE = 1000;
/** Don't delete remote files younger than this: another device may be mid-sync. */
const DELETE_GRACE_MS = 15 * 60 * 1000;

/** Every photo id a log points at. */
export function referencedPhotos(logs: Logs): Set<string> {
  const ids = new Set<string>();
  for (const l of Object.values(logs)) {
    for (const id of l.photoIds ?? []) if (id) ids.add(id);
    if (l.proof?.photoId) ids.add(l.proof.photoId);
  }
  return ids;
}

export interface MediaPlan {
  upload: string[];
  download: string[];
  remove: string[];
}

/** Pure diff, so the rules are testable without a server. */
export function planMedia(referenced: Set<string>, local: Set<string>, remote: Map<string, number>, now: number): MediaPlan {
  return {
    upload: [...referenced].filter((id) => local.has(id) && !remote.has(id)),
    download: [...referenced].filter((id) => !local.has(id) && remote.has(id)),
    remove: [...remote].filter(([id, created]) => !referenced.has(id) && now - created > DELETE_GRACE_MS).map(([id]) => id),
  };
}

async function listRemote(userId: string): Promise<Map<string, number>> {
  const sb = requireClient();
  const out = new Map<string, number>();
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage.from(BUCKET).list(userId, { limit: PAGE, offset });
    if (error) throw error;
    for (const f of data ?? []) if (f.name.endsWith('.bin')) out.set(f.name.slice(0, -4), Date.parse(f.created_at ?? '') || 0);
    if (!data || data.length < PAGE) return out;
  }
}

/** Returns how many photos were downloaded, so the UI knows to refresh. */
export async function syncPhotos(userId: string, key: CryptoKey, logs: Logs, repo: Repo): Promise<number> {
  const sb = requireClient();
  const referenced = referencedPhotos(logs);
  const local = new Set((await repo.allPhotos()).map((p) => p.id));
  const plan = planMedia(referenced, local, await listRemote(userId), Date.now());
  const path = (id: string) => `${userId}/${id}.bin`;

  for (const id of plan.upload) {
    const row = await repo.getPhoto(id);
    if (!row) continue;
    const sealed = await sealBytes(key, await row.blob.arrayBuffer());
    const { error } = await sb.storage.from(BUCKET).upload(path(id), new Blob([sealed], { type: 'application/octet-stream' }), { upsert: true });
    if (error) throw error;
  }
  let downloaded = 0;
  for (const id of plan.download) {
    const { data, error } = await sb.storage.from(BUCKET).download(path(id));
    if (error) throw error;
    const plain = await openBytes(key, await data.arrayBuffer());
    await repo.putPhoto(new Blob([plain], { type: 'image/jpeg' }), id);
    downloaded++;
  }
  if (plan.remove.length) {
    const { error } = await sb.storage.from(BUCKET).remove(plan.remove.map(path));
    if (error) throw error;
  }
  return downloaded;
}
