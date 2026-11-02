import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
          detectSessionInUrl: true,
        },
      })
    : null;

export const cloudEnabled = supabase !== null;

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error('Cloud features are not configured for this build.');
  return supabase;
}

/** Where auth emails send people back to: this app's own URL, without query or hash. */
export const appUrl = () => `${location.origin}${location.pathname}`;
