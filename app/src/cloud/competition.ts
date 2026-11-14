import { requireClient } from './client';
import { PROFILE_COLS, type Profile } from './social';

// Guilds, duels, leagues and the monthly boss. Server rules live in
// supabase/migrations/20261115000000_competition.sql.

export const LEAGUES = [
  { name: 'Bronze', color: '#cd7f32' },
  { name: 'Silver', color: '#c0c8d8' },
  { name: 'Gold', color: '#ffd700' },
  { name: 'Platinum', color: '#7fe3ff' },
  { name: 'Diamond', color: '#b98cff' },
  { name: 'Monarch', color: '#ff4060' },
] as const;

export const leagueOf = (n: number | undefined) => LEAGUES[Math.max(0, Math.min(5, n ?? 0))]!;

// ── Guilds ──

export interface Guild {
  id: string;
  name: string;
  tag: string;
  owner: string;
  invite_code: string;
  created_at: string;
}

export interface GuildMember {
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile: Profile | null;
}

export async function myGuilds(): Promise<Guild[]> {
  const { data, error } = await requireClient().from('guilds').select('id, name, tag, owner, invite_code, created_at').order('created_at');
  if (error) throw error;
  return (data ?? []) as Guild[];
}

export async function createGuild(me: string, name: string, tag: string): Promise<Guild> {
  const { data, error } = await requireClient()
    .from('guilds')
    .insert({ name: name.trim(), tag: tag.trim().toUpperCase(), owner: me })
    .select('id, name, tag, owner, invite_code, created_at')
    .single();
  if (error) throw error;
  return data as Guild;
}

export async function joinGuild(code: string): Promise<string> {
  const { data, error } = await requireClient().rpc('join_guild', { code });
  if (error) throw error;
  return data as string;
}

export async function guildMembers(guildId: string): Promise<GuildMember[]> {
  const sb = requireClient();
  const { data, error } = await sb.from('guild_members').select('user_id, role, joined_at').eq('guild_id', guildId);
  if (error) throw error;
  const rows = (data ?? []) as Omit<GuildMember, 'profile'>[];
  const ids = rows.map((r) => r.user_id);
  const { data: profs, error: pErr } = ids.length ? await sb.from('profiles').select(PROFILE_COLS).in('id', ids) : { data: [], error: null };
  if (pErr) throw pErr;
  const byId = new Map(((profs ?? []) as Profile[]).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
}

export async function leaveGuild(guildId: string, userId: string) {
  const { error } = await requireClient().from('guild_members').delete().eq('guild_id', guildId).eq('user_id', userId);
  if (error) throw error;
}

export async function disbandGuild(guildId: string) {
  const { error } = await requireClient().from('guilds').delete().eq('id', guildId);
  if (error) throw error;
}

// ── Duels ──

export interface Duel {
  id: string;
  challenger: string;
  opponent: string;
  status: 'pending' | 'active' | 'declined' | 'cancelled';
  starts_on: string | null;
  challenger_score: number;
  opponent_score: number;
  created_at: string;
}

export const DUEL_DAYS = 7;

export async function myDuels(): Promise<Duel[]> {
  const { data, error } = await requireClient().from('duels').select('*').order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []) as Duel[];
}

export async function challenge(me: string, opponent: string) {
  const { error } = await requireClient().from('duels').insert({ challenger: me, opponent });
  if (error) throw error;
}

export async function respondDuel(id: string, accept: boolean) {
  const { error } = await requireClient().rpc('respond_duel', { duel: id, accept });
  if (error) throw error;
}

export async function cancelDuel(id: string) {
  const { error } = await requireClient().rpc('cancel_duel', { duel: id });
  if (error) throw error;
}

export async function reportDuelScore(id: string, score: number) {
  const { error } = await requireClient().rpc('report_duel_score', { duel: id, score });
  if (error) throw error;
}

// ── Monthly boss ──

export async function bossStatus(month: string): Promise<{ total: number; participants: number }> {
  const { data, error } = await requireClient().rpc('boss_status', { m: month });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { total: number; participants: number } | undefined;
  return { total: Number(row?.total ?? 0), participants: Number(row?.participants ?? 0) };
}

export async function reportBossDamage(me: string, month: string, damage: number) {
  const { error } = await requireClient()
    .from('boss_hits')
    .upsert({ user_id: me, month, damage: Math.max(0, Math.min(775, Math.round(damage))), updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function profilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  if (!ids.length) return new Map();
  const { data, error } = await requireClient().from('profiles').select(PROFILE_COLS).in('id', ids);
  if (error) throw error;
  return new Map(((data ?? []) as Profile[]).map((p) => [p.id, p]));
}
