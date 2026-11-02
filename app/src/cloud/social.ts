import type { AchievementKind } from '../domain';
import { requireClient } from './client';

export interface PublicStats {
  level: number;
  rank: string;
  streak: number;
  weekExp: number;
  /** Monday of the week `weekExp` is for. */
  week: string;
}

export interface Profile {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  created_at: string;
  stats: PublicStats | null;
}

/** Server-side visibility. "Private" photos never get this far. */
export type Visibility = 'public' | 'followers';

export interface Feat {
  id: string;
  user_id: string;
  kind: AchievementKind | 'custom' | 'proof';
  title: string;
  body: string;
  visibility: Visibility;
  created_at: string;
  image_path: string | null;
  /** Short-lived signed URL for the photo, if any. */
  imageUrl: string | null;
  author: Pick<Profile, 'id' | 'handle' | 'display_name'>;
  likeCount: number;
  likedByMe: boolean;
}

const PAGE = 20;
const PROFILE_COLS = 'id, handle, display_name, bio, created_at, stats';
const BUCKET = 'feat-media';
const SIGNED_URL_SECONDS = 60 * 60;

export async function myProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireClient().from('profiles').select(PROFILE_COLS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, patch: Partial<Pick<Profile, 'display_name' | 'bio'>>) {
  const { error } = await requireClient().from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export async function profileByHandle(handle: string): Promise<Profile | null> {
  const { data, error } = await requireClient().from('profiles').select(PROFILE_COLS).eq('handle', handle).maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchProfiles(q: string): Promise<Profile[]> {
  const term = q.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!term) return [];
  const { data, error } = await requireClient().from('profiles').select(PROFILE_COLS).ilike('handle', `${term}%`).limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function followCounts(userId: string) {
  const sb = requireClient();
  const [followers, following] = await Promise.all([
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('followee', userId),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower', userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function followingIds(me: string): Promise<Set<string>> {
  const { data, error } = await requireClient().from('follows').select('followee').eq('follower', me);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.followee as string));
}

export async function follow(me: string, other: string) {
  const { error } = await requireClient().from('follows').insert({ follower: me, followee: other });
  if (error && error.code !== '23505') throw error;
}

export async function unfollow(me: string, other: string) {
  const { error } = await requireClient().from('follows').delete().eq('follower', me).eq('followee', other);
  if (error) throw error;
}

export async function block(me: string, other: string) {
  const { error } = await requireClient().from('blocks').insert({ blocker: me, blocked: other });
  if (error && error.code !== '23505') throw error;
}

export async function unblock(me: string, other: string) {
  const { error } = await requireClient().from('blocks').delete().eq('blocker', me).eq('blocked', other);
  if (error) throw error;
}

export async function blockedProfiles(me: string): Promise<Profile[]> {
  const sb = requireClient();
  const { data, error } = await sb.from('blocks').select('blocked').eq('blocker', me);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.blocked as string);
  if (!ids.length) return [];
  const { data: profs, error: pErr } = await sb.from('profiles').select(PROFILE_COLS).in('id', ids);
  if (pErr) throw pErr;
  return profs ?? [];
}

export async function report(me: string, target: { featId?: string; userId?: string }, reason: string) {
  const { error } = await requireClient()
    .from('reports')
    .insert({ reporter: me, feat_id: target.featId ?? null, reported_user: target.userId ?? null, reason });
  if (error) throw error;
}

/**
 * Posts a feat. With an image, the photo is uploaded first into the poster's own
 * folder; if the feat insert then fails, the orphaned photo is removed again.
 */
export async function postFeat(
  me: string,
  feat: { kind: Feat['kind']; title: string; body: string; visibility: Visibility },
  image?: Blob,
): Promise<string> {
  const sb = requireClient();
  let image_path: string | null = null;
  if (image) {
    image_path = `${me}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(image_path, image, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
  }
  const { data, error } = await sb.from('feats').insert({ user_id: me, ...feat, image_path }).select('id').single();
  if (error) {
    if (image_path) await sb.storage.from(BUCKET).remove([image_path]);
    throw error;
  }
  return data.id as string;
}

export async function deleteFeat(id: string, imagePath?: string | null) {
  const sb = requireClient();
  const { error } = await sb.from('feats').delete().eq('id', id);
  if (error) throw error;
  if (imagePath) await sb.storage.from(BUCKET).remove([imagePath]);
}

/** Publishes (or with null, withdraws) leaderboard stats on your profile. */
export async function publishStats(me: string, stats: PublicStats | null) {
  const { error } = await requireClient().from('profiles').update({ stats }).eq('id', me);
  if (error) throw error;
}

export type BoardScope = { kind: 'following'; ids: string[] } | { kind: 'global' };

/** Weekly EXP leaderboard among hunters who share stats. */
export async function leaderboard(scope: BoardScope, week: string): Promise<Profile[]> {
  let q = requireClient()
    .from('profiles')
    .select(PROFILE_COLS)
    .not('stats', 'is', null)
    .eq('stats->>week', week)
    .order('stats->weekExp', { ascending: false })
    .limit(50);
  if (scope.kind === 'following') q = q.in('id', scope.ids);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export type FeedScope = { kind: 'following'; me: string; following: string[] } | { kind: 'explore' } | { kind: 'user'; userId: string };

/** RLS already hides anything the viewer may not see; scopes only narrow it down. */
export async function feed(me: string, scope: FeedScope, before?: string): Promise<Feat[]> {
  const sb = requireClient();
  let q = sb
    .from('feats')
    .select('id, user_id, kind, title, body, visibility, created_at, image_path, author:profiles!feats_user_id_fkey(id, handle, display_name), likes(count)')
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (before) q = q.lt('created_at', before);
  if (scope.kind === 'following') q = q.in('user_id', [scope.me, ...scope.following]);
  if (scope.kind === 'explore') q = q.eq('visibility', 'public');
  if (scope.kind === 'user') q = q.eq('user_id', scope.userId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Omit<Feat, 'likeCount' | 'likedByMe' | 'author' | 'imageUrl'> & {
    author: Feat['author'] | null;
    likes: { count: number }[];
  })[];
  const ids = rows.map((r) => r.id);
  const mine = new Set<string>();
  if (ids.length) {
    const { data: liked } = await sb.from('likes').select('feat_id').eq('user_id', me).in('feat_id', ids);
    for (const l of liked ?? []) mine.add(l.feat_id as string);
  }
  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return rows
    .filter((r) => r.author)
    .map(({ likes, author, ...r }) => ({
      ...r,
      author: author!,
      imageUrl: r.image_path ? (urls.get(r.image_path) ?? null) : null,
      likeCount: likes[0]?.count ?? 0,
      likedByMe: mine.has(r.id),
    }));
}

export async function like(me: string, featId: string) {
  const { error } = await requireClient().from('likes').insert({ user_id: me, feat_id: featId });
  if (error && error.code !== '23505') throw error;
}

export async function unlike(me: string, featId: string) {
  const { error } = await requireClient().from('likes').delete().eq('user_id', me).eq('feat_id', featId);
  if (error) throw error;
}

export const FEED_PAGE = PAGE;
