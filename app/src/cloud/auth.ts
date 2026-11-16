import { appUrl, requireClient } from './client';

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const MIN_PASSWORD = 10;

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (!/[a-zA-Z]/.test(pw) || !/[0-9\W_]/.test(pw)) return 'Mix letters with numbers or symbols.';
  return null;
}

export async function handleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await requireClient().rpc('handle_available', { h: handle });
  if (error) throw error;
  return data === true;
}

export async function signUp(email: string, password: string, handle: string, displayName: string) {
  const { data, error } = await requireClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl(), data: { handle, display_name: displayName } },
  });
  if (error) throw error;
  /** False when the project requires email confirmation before first sign-in. */
  return { signedIn: !!data.session };
}

export async function signIn(email: string, password: string) {
  const { error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await requireClient().auth.signOut();
}

export async function sendPasswordReset(email: string) {
  const { error } = await requireClient().auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw error;
}

/** Every file the user uploaded, in each bucket, so deleting the account leaves nothing behind. */
async function removeOwnFiles(userId: string) {
  const sb = requireClient();
  for (const bucket of ['avatars', 'feat-media', 'vault-media']) {
    for (;;) {
      const { data, error } = await sb.storage.from(bucket).list(userId, { limit: 100 });
      if (error || !data?.length) break;
      const { error: rmErr } = await sb.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
      if (rmErr) throw rmErr;
      if (data.length < 100) break;
    }
  }
}

/**
 * Deletes the account: first your uploaded photos, then (by cascade from the auth user)
 * vault, profile, feats, follows, likes, guild memberships, guilds you own, duels and boss hits.
 */
export async function deleteAccount() {
  const sb = requireClient();
  const { data } = await sb.auth.getUser();
  if (data.user) await removeOwnFiles(data.user.id);
  const { error } = await sb.rpc('delete_account');
  if (error) throw error;
  // The server-side session is gone with the user; just forget it locally.
  await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
}
