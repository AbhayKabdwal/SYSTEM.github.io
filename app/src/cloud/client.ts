import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isNative, NATIVE_AUTH_URL } from '../native/platform';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Null when the build has no Supabase config: the app then runs fully offline
 * and hides account, sync and social features.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // PKCE puts the auth code in ?code=, which doesn't collide with the #/ router.
          flowType: 'pkce',
          persistSession: true,
          // In the Android app, links come back through a deep link instead (native/init.ts).
          detectSessionInUrl: !isNative,
        },
      })
    : null;

export const cloudEnabled = supabase !== null;

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error('Cloud features are not configured for this build.');
  return supabase;
}

/**
 * Where auth emails send people back to: this site's own URL, or in the Android app
 * a deep link that reopens the app.
 */
export const appUrl = () => (isNative ? NATIVE_AUTH_URL : `${location.origin}${location.pathname}`);
