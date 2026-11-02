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

/** Deletes the account and, by cascade, the vault, profile, feats, follows and likes. */
export async function deleteAccount() {
  const sb = requireClient();
  const { error } = await sb.rpc('delete_account');
  if (error) throw error;
  await sb.auth.signOut();
}
