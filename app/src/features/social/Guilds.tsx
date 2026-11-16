import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createGuild, disbandGuild, guildMembers, joinGuild, leaveGuild, myGuilds, type Guild, type GuildMember } from '../../cloud/competition';
import { addDays, nameProblem, weekOf } from '../../domain';
import { useApp } from '../../state/store';
import { useMeId } from '../../cloud/demoHooks';
import { demoNet } from '../../cloud/demoNetwork';
import { Card, ErrorText, Field, Sec } from '../../ui/components';
import { useToday } from '../../ui/hooks';
import { toast } from '../../ui/notify';
import { BoardRows } from './LeagueBoard';

/** Weekly guild goal: 250 Effort Points per member. */
export const GUILD_EP_PER_MEMBER = 250;

export function GuildsPanel() {
  const me = useMeId()!;
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    myGuilds()
      .then(setGuilds)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const act = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <Sec>MY GUILDS</Sec>
        {guilds === null && !error && <p className="hint">Loading…</p>}
        {guilds?.length === 0 && <p className="prose muted">You're not in a guild yet. Create one and share the invite code, or join with a friend's code.</p>}
        {guilds?.map((g) => (
          <Link key={g.id} to={`/guild/${g.id}`} className="list-item">
            <span className="league-badge" style={{ color: 'var(--glow)' }}>
              {g.tag}
            </span>
            <div style={{ flex: 1 }}>
              <div className="list-title">{g.name}</div>
              <div className="list-sub">{g.owner === me ? 'Owner' : 'Member'}</div>
            </div>
            <span className="muted" aria-hidden>
              ›
            </span>
          </Link>
        ))}
        <ErrorText error={error} />
      </Card>
      <Card>
        <Sec>JOIN A GUILD</Sec>
        <form
          onSubmit={act(async () => {
            const id = await joinGuild(code);
            toast('JOINED THE GUILD');
            navigate(`/guild/${id}`);
          })}
        >
          <Field label="INVITE CODE">
            {(id) => <input id={id} className="inp" autoCapitalize="characters" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />}
          </Field>
          <button className="btn btn-sm" disabled={busy || code.trim().length < 6}>
            JOIN
          </button>
        </form>
      </Card>
      <Card>
        <Sec>CREATE A GUILD</Sec>
        <form
          onSubmit={act(async () => {
            const problem = nameProblem(name) ?? nameProblem(tag);
            if (problem) throw new Error(problem);
            const g = await createGuild(me, name, tag);
            toast('GUILD CREATED');
            navigate(`/guild/${g.id}`);
          })}
        >
          <Field label="NAME">{(id) => <input id={id} className="inp" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="TAG" hint="2–5 letters or digits, shown next to the name.">
            {(id) => <input id={id} className="inp" maxLength={5} value={tag} onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />}
          </Field>
          <button className="btn btn-sm btn-gold" disabled={busy || name.trim().length < 3 || tag.length < 2}>
            CREATE
          </button>
        </form>
      </Card>
    </>
  );
}

/**
 * Days in a row (ending today, or yesterday if today is still open for someone) on
 * which every member who shares stats kept their streak alive.
 */
export function guildStreak(members: GuildMember[], today: string): number {
  const sharing = members.map((m) => m.profile?.stats).filter((s) => s?.kept && s.day);
  if (!sharing.length) return 0;
  const keptOn = (d: string) =>
    sharing.every((s) => {
      const back = (Date.parse(s!.day!) - Date.parse(d)) / 86_400_000;
      const i = s!.kept!.length - 1 - Math.round(back);
      return i >= 0 && i < s!.kept!.length && s!.kept![i] === '1';
    });
  let d = keptOn(today) ? today : addDays(today, -1);
  let n = 0;
  while (n < 14 && keptOn(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function GuildPage() {
  const { id = '' } = useParams();
  const me = useMeId();
  const share = useApp((s) => s.player?.shareStats);
  const today = useToday();
  const navigate = useNavigate();
  const [guild, setGuild] = useState<Guild | null | undefined>(undefined);
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const gs = await myGuilds();
      const g = gs.find((x) => x.id === id) ?? null;
      setGuild(g);
      if (g) setMembers(await guildMembers(g.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  const week = weekOf(today)[0]!;
  const board = useMemo(
    () =>
      members
        .map((m) => m.profile)
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => (p.stats?.week === week ? p : { ...p, stats: p.stats ? { ...p.stats, weekEp: 0 } : null }))
        .sort((a, b) => (b.stats?.weekEp ?? -1) - (a.stats?.weekEp ?? -1)),
    [members, week],
  );
  const goal = GUILD_EP_PER_MEMBER * Math.max(1, members.length);
  const progress = board.reduce((s, p) => s + (p.stats?.weekEp ?? 0), 0);
  const streak = guildStreak(members, today);
  const hidden = members.filter((m) => !m.profile?.stats).length;

  if (!me) return null;
  if (guild === undefined) return <div className="page">{error ? <ErrorText error={error} /> : <p className="hint">Loading…</p>}</div>;
  if (!guild)
    return (
      <div className="page">
        <Card>
          <p className="prose">This guild doesn't exist or you're not a member.</p>
        </Card>
      </div>
    );
  const isOwner = guild.owner === me;

  return (
    <div className="page">
      <Card>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
          <span className="league-badge" style={{ color: 'var(--glow)' }}>
            {guild.tag}
          </span>
          <div className="rank-name">{guild.name}</div>
        </div>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <div className="stat-card">
            <div className="stat-val">{members.length}</div>
            <div className="stat-lbl">MEMBERS</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ color: '#ff8844' }}>
              {streak}
            </div>
            <div className="stat-lbl">GUILD STREAK</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{Math.min(100, Math.round((progress / goal) * 100))}%</div>
            <div className="stat-lbl">WEEKLY GOAL</div>
          </div>
        </div>
        <div className="label">
          GUILD QUEST · {progress.toLocaleString()} / {goal.toLocaleString()} EP THIS WEEK
        </div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${Math.min(100, (progress / goal) * 100)}%`, background: 'var(--gold)' }} />
        </div>
        <p className="hint">
          Guild streak counts days when every member who shares stats kept their streak (cleared with proof, rested, or used a shield).
          {hidden ? ` ${hidden} member${hidden > 1 ? 's' : ''} don't share stats and aren't counted.` : ''}
        </p>
        {!share && !demoNet() && (
          <p className="hint" style={{ color: 'var(--gold)' }}>
            Your guild can't see your progress. Turn on <Link to="/account">Share stats</Link>.
          </p>
        )}
      </Card>

      <Card>
        <Sec>THIS WEEK</Sec>
        <BoardRows rows={board} me={me} />
      </Card>

      <Card>
        <Sec>INVITE</Sec>
        <div className="row">
          <span style={{ fontFamily: 'var(--hd)', fontSize: 20, letterSpacing: 4, color: 'var(--bright)' }}>{guild.invite_code}</span>
          <button
            className="btn btn-sm"
            style={{ width: 'auto' }}
            onClick={async () => {
              const text = `Join my guild "${guild.name}" in SYSTEM. Invite code: ${guild.invite_code}`;
              try {
                if (navigator.share) await navigator.share({ text });
                else {
                  await navigator.clipboard.writeText(text);
                  toast('INVITE COPIED');
                }
              } catch {
                /* share sheet dismissed */
              }
            }}
          >
            SHARE
          </button>
        </div>
        <p className="hint">Anyone with this code can join (30 members max).</p>
      </Card>

      <button
        className="btn btn-red"
        onClick={async () => {
          if (!confirm(isOwner ? `Disband ${guild.name}? This removes the guild for everyone.` : `Leave ${guild.name}?`)) return;
          try {
            if (isOwner) await disbandGuild(guild.id);
            else await leaveGuild(guild.id, me);
            toast(isOwner ? 'GUILD DISBANDED' : 'LEFT THE GUILD');
            navigate('/hunters', { state: { tab: 'guilds' } });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {isOwner ? 'DISBAND GUILD' : 'LEAVE GUILD'}
      </button>
      {isOwner && members.length > 1 && (
        <Card>
          <Sec>MEMBERS</Sec>
          {members
            .filter((m) => m.user_id !== me)
            .map((m) => (
              <div className="row" key={m.user_id} style={{ padding: '6px 0' }}>
                <span>{m.profile?.display_name ?? 'Hunter'}</span>
                <button
                  className="link-btn"
                  onClick={async () => {
                    if (!confirm(`Remove ${m.profile?.display_name ?? 'this hunter'} from the guild?`)) return;
                    await leaveGuild(guild.id, m.user_id).catch((e: Error) => setError(e.message));
                    void load();
                  }}
                >
                  remove
                </button>
              </div>
            ))}
        </Card>
      )}
      <ErrorText error={error} />
    </div>
  );
}
