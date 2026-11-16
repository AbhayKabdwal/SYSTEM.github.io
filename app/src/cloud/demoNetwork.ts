import { addDays, todayStr, weekOf } from '../domain';
import type { Duel, Guild, GuildMember } from './competition';
import type { Feat, Profile, PublicStats } from './social';

// Sample network for trying the Hunters screens without a server or other players.
// Developer mode only. Everything lives in memory on this device: nothing is read
// from or written to Supabase, and it resets when the app reloads.

const KEY = 'sys:demoNet';

export const demoNet = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export function setDemoNet(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

export const DEMO_ME = 'demo-me';

const today = () => todayStr();
const week = () => weekOf(today())[0]!;
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function stats(level: number, rank: string, streak: number, weekEp: number, kept = '11111111111111'): PublicStats {
  const recentEp = [...kept].map((k, i) => (k === '1' ? 60 + ((i * 7 + level) % 35) : 0));
  return { level, rank, streak, weekExp: weekEp * 5, weekEp, week: week(), day: today(), recentEp, kept };
}

const HUNTERS: [string, string, string, number, string, number, number, number, string?][] = [
  // id, handle, name, level, rank, streak, weekEp, league, kept
  [DEMO_ME, 'you', 'You (sample)', 12, 'D', 9, 410, 1],
  ['demo-1', 'ironveil', 'Ira Veil', 58, 'A', 121, 655, 4],
  ['demo-2', 'ashrunner', 'Kabir Ash', 33, 'C', 44, 590, 2],
  ['demo-3', 'frostbyte', 'Mei Frost', 71, 'S', 260, 690, 5],
  ['demo-4', 'night_owl', 'Arjun N.', 14, 'D', 6, 380, 1, '11110111111011'],
  ['demo-5', 'stormkeeper', 'Zara Storm', 22, 'C', 17, 455, 1],
  ['demo-6', 'grit_daily', 'Dev Grit', 9, 'E', 3, 240, 0, '00011101111111'],
  ['demo-7', 'pistol_pete', 'Pete K.', 41, 'B', 63, 600, 3],
  ['demo-8', 'calm_reps', 'Sana R.', 17, 'D', 12, 470, 1],
  ['demo-9', 'hollowfang', 'Leo Hollow', 11, 'D', 2, 150, 1, '10010011100011'],
  ['demo-10', 'tuckplanche', 'Ana Tuck', 27, 'C', 33, 520, 2],
  ['demo-11', 'quietpower', 'Om Prakash', 6, 'E', 5, 300, 0],
];

const PROFILES: Profile[] = HUNTERS.map(([id, handle, display_name, level, rank, streak, weekEp, league, kept], i) => ({
  id,
  handle,
  display_name,
  bio: id === DEMO_ME ? 'This is a sample profile.' : ['Training every day.', 'Chasing the planche.', 'Morning runs, evening pull-ups.', ''][i % 4]!,
  created_at: ago(24 * (30 + i * 9)),
  stats: stats(level, rank, streak, weekEp, kept),
  avatar_path: null,
  league,
}));

const byId = (id: string) => PROFILES.find((p) => p.id === id)!;
const author = (id: string) => {
  const p = byId(id);
  return { id: p.id, handle: p.handle, display_name: p.display_name, avatar_path: null };
};

let following = new Set(['demo-1', 'demo-2', 'demo-3', 'demo-5', 'demo-8']);
let liked = new Set<string>(['f2']);

let feats: Feat[] = [
  ['f1', 'demo-3', 'proof', 'Cleared the S-Rank daily quest', '35 Archer Pull-ups · 20 Nordic Curl Negatives · 270 sec Wall Sit', 'public', 1, 14],
  ['f2', 'demo-1', 'streak', '120-day streak · Monarch’s Flame', '120 days without missing a quest', 'followers', 3, 9],
  ['f3', 'demo-2', 'skill', 'Unlocked Tuck Planche', 'PLANCHE skill tree', 'public', 5, 6],
  ['f4', 'demo-5', 'proof', 'Cleared the C-Rank daily quest', '40 Diamond Push-ups · 4 km Run · 90 sec Hollow Body Hold', 'followers', 8, 3],
  ['f5', 'demo-8', 'milestone', '50 quests cleared', '50 daily quests cleared in total', 'public', 20, 11],
  ['f6', 'demo-7', 'rank', 'B-Rank · Level 41', 'Shadow Soldier · 71,240 EXP', 'public', 26, 22],
  ['f7', 'demo-10', 'custom', 'First muscle-up!', 'Took 9 weeks of negatives. Worth it.', 'public', 30, 31],
  ['f8', 'demo-4', 'quest', 'Penalty quest survived', 'Streak restored. Never again.', 'followers', 40, 4],
  ['f9', 'demo-11', 'custom', 'Week one done', 'Grade B on my first weekly report.', 'public', 52, 7],
  ['f10', 'demo-6', 'proof', 'Cleared the E-Rank daily quest', '20 Push-ups · 30 Glute Bridges · 40 Bodyweight Squats', 'public', 70, 2],
].map(([id, uid, kind, title, body, visibility, h, likes]) => ({
  id: id as string,
  user_id: uid as string,
  kind: kind as Feat['kind'],
  title: title as string,
  body: body as string,
  visibility: visibility as Feat['visibility'],
  created_at: ago(h as number),
  image_path: null,
  imageUrl: null,
  author: author(uid as string),
  likeCount: likes as number,
  likedByMe: liked.has(id as string),
}));

const GUILD: Guild = { id: 'demo-guild', name: 'Shadow Legion', tag: 'SL', owner: 'demo-1', invite_code: 'DEMO1234', created_at: ago(24 * 40) };
const GUILD_MEMBERS = [DEMO_ME, 'demo-1', 'demo-2', 'demo-4', 'demo-8', 'demo-10'];
let inGuild = true;

let duels: Duel[] = [
  { id: 'd1', challenger: DEMO_ME, opponent: 'demo-4', status: 'active', starts_on: addDays(today(), -3), challenger_score: 0, opponent_score: 236, created_at: ago(96) },
  { id: 'd2', challenger: 'demo-5', opponent: DEMO_ME, status: 'pending', starts_on: null, challenger_score: 0, opponent_score: 0, created_at: ago(5) },
  { id: 'd3', challenger: DEMO_ME, opponent: 'demo-9', status: 'active', starts_on: addDays(today(), -14), challenger_score: 512, opponent_score: 388, created_at: ago(24 * 15) },
];

const later = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));

export const demo = {
  profile: byId,
  myProfile: () => later(byId(DEMO_ME)),
  profileByHandle: (h: string) => later(PROFILES.find((p) => p.handle === h) ?? null),
  search: (q: string) => {
    const t = q.trim().replace(/^@/, '').toLowerCase();
    return later(t ? PROFILES.filter((p) => p.handle.includes(t) || p.display_name.toLowerCase().includes(t)) : []);
  },
  followCounts: (id: string) => later(id === DEMO_ME ? { followers: 7, following: following.size } : { followers: 10 + id.length * 3, following: 12 }),
  followingIds: () => later(new Set(following)),
  follow: (other: string) => later(void (following = new Set([...following, other]))),
  unfollow: (other: string) => later(void following.delete(other)),
  feed: (scope: 'following' | 'explore' | 'user', userId?: string) =>
    later(
      feats
        .filter((f) => (scope === 'user' ? f.user_id === userId : scope === 'following' ? f.user_id === DEMO_ME || following.has(f.user_id) : f.visibility === 'public'))
        .map((f) => ({ ...f, likedByMe: liked.has(f.id) })),
    ),
  like: (id: string) => later(void (liked = new Set([...liked, id]))),
  unlike: (id: string) => later(void liked.delete(id)),
  post: (feat: Pick<Feat, 'kind' | 'title' | 'body' | 'visibility'>) => {
    const f: Feat = { ...feat, id: `f${Date.now()}`, user_id: DEMO_ME, created_at: new Date().toISOString(), image_path: null, imageUrl: null, author: author(DEMO_ME), likeCount: 0, likedByMe: false };
    feats = [f, ...feats];
    return later(f.id);
  },
  deleteFeat: (id: string) => later(void (feats = feats.filter((f) => f.id !== id))),
  leaderboard: (scope: { kind: string; ids?: string[]; league?: number }) =>
    later(
      PROFILES.filter((p) => (scope.kind === 'league' ? p.league === scope.league : scope.kind === 'global' ? true : (scope.ids ?? []).includes(p.id))).sort(
        (a, b) => (b.stats?.weekEp ?? 0) - (a.stats?.weekEp ?? 0),
      ),
    ),
  myGuilds: () => later(inGuild ? [GUILD] : []),
  guildMembers: () =>
    later<GuildMember[]>(GUILD_MEMBERS.map((id) => ({ user_id: id, role: id === GUILD.owner ? 'owner' : 'member', joined_at: ago(24 * 20), profile: byId(id) }))),
  joinGuild: () => later(void (inGuild = true)).then(() => GUILD.id),
  leaveGuild: () => later(void (inGuild = false)),
  myDuels: () => later([...duels]),
  challenge: (opponent: string) => later(void duels.unshift({ id: `d${Date.now()}`, challenger: DEMO_ME, opponent, status: 'pending', starts_on: null, challenger_score: 0, opponent_score: 0, created_at: new Date().toISOString() })),
  respondDuel: (id: string, accept: boolean) =>
    later(void (duels = duels.map((d) => (d.id === id ? { ...d, status: accept ? 'active' : 'declined', starts_on: accept ? addDays(today(), 1) : null } : d)))),
  cancelDuel: (id: string) => later(void (duels = duels.map((d) => (d.id === id ? { ...d, status: 'cancelled' } : d)))),
  bossStatus: () => later({ total: 2_150, participants: 9 }),
  profilesByIds: (ids: string[]) => later(new Map(ids.filter((id) => PROFILES.some((p) => p.id === id)).map((id) => [id, byId(id)]))),
};
