// Blocks offensive handles, display names, bios and guild names.
//
// The same lists live in supabase/migrations/20261116000000_moderation.sql, which enforces
// them on the server; moderation.test.ts fails if the two drift apart. The app checks
// first only so people get a clear message instead of a database error.
//
// Matching is deliberately conservative to avoid blocking real names (the "Scunthorpe
// problem"): short or ambiguous words only match as whole words.

/** Matched anywhere in the letters, after leetspeak is undone: "f_u_c_k", "sh1t". */
export const BLOCK_SUBSTR = [
  'fuck', 'fck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'slut', 'pussy', 'penis', 'vagina', 'porn', 'twat', 'wank',
  'hitler', 'retard', 'rapist', 'asshole', 'dickhead', 'cocksuck', 'motherfuck', 'jerkoff', 'dildo', 'boobs',
  'chutiya', 'chutia', 'madarchod', 'maderchod', 'behenchod', 'bhenchod', 'bhosdi', 'bhosda', 'gaandu', 'gandu', 'lawda', 'harami',
];

/** Matched anywhere after repeated letters are squeezed: "fuuuck", "shiiit". */
export const BLOCK_SQUEEZED = ['fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'pusy', 'fagot', 'chutiya', 'madarchod', 'bhenchod', 'behenchod', 'bhosdi', 'gandu', 'harami', 'ashole'];

/** Matched only as a whole word, since they appear inside ordinary names ("Nazia", "Dickson"). */
export const BLOCK_WORDS = ['ass', 'dick', 'cock', 'cum', 'sex', 'tit', 'tits', 'fag', 'hoe', 'nazi', 'randi', 'lund', 'lauda', 'kkk', 'stfu', 'gand', 'rape'];

/** Handles that could impersonate the app or its staff. */
export const RESERVED_HANDLES = ['admin', 'administrator', 'system', 'support', 'moderator', 'mod', 'mods', 'official', 'staff', 'help', 'root', 'owner', 'security', 'null', 'undefined', 'api', 'www'];

const LEET_FROM = '0134578@$!|';
const LEET_TO = 'oieastbasii';

export function normalizeName(text: string): string {
  let s = text.toLowerCase();
  s = [...s].map((c) => {
    const i = LEET_FROM.indexOf(c);
    return i >= 0 ? LEET_TO[i]! : c;
  }).join('');
  return s;
}

/**
 * Why a name isn't allowed, or null if it's fine. `handle` also rejects reserved words.
 * Kept in step with public.name_problem() in SQL.
 */
export function nameProblem(text: string, kind: 'handle' | 'name' | 'text' = 'name'): string | null {
  const norm = normalizeName(text);
  const letters = norm.replace(/[^a-z]/g, '');
  const squeezed = letters.replace(/(.)\1+/g, '$1');
  const words = norm.split(/[^a-z]+/).filter(Boolean);
  // Reserved check ignores digits rather than reading them as letters: "support_1" is "support".
  if (kind === 'handle' && RESERVED_HANDLES.includes(text.toLowerCase().replace(/[^a-z]/g, ''))) return 'That handle is reserved.';
  const offensive =
    BLOCK_SUBSTR.some((w) => letters.includes(w)) ||
    BLOCK_SQUEEZED.some((w) => squeezed.includes(w)) ||
    words.some((w) => BLOCK_WORDS.includes(w)) ||
    (kind !== 'text' && BLOCK_WORDS.includes(letters));
  return offensive ? 'That contains a word that isn’t allowed. Choose something else.' : null;
}
