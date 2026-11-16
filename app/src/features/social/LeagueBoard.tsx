import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { avatarUrl, followingIds, leaderboard, type BoardScope, type Profile } from '../../cloud/social';
import { leagueOf, LEAGUES } from '../../cloud/competition';
import { RANK_GATES, weekOf } from '../../domain';
import { useApp } from '../../state/store';
import { useSession } from '../../state/session';
import { useMeId } from '../../cloud/demoHooks';
import { demo, DEMO_ME, demoNet } from '../../cloud/demoNetwork';
import { Avatar } from '../../ui/Avatar';
import { Card, ErrorText, Sec, Seg } from '../../ui/components';
import { useToday } from '../../ui/hooks';

/** Rows of a board, with promotion and relegation zones for league boards. */
export function BoardRows({ rows, me, zones }: { rows: Profile[]; me: string; zones?: boolean }) {
  const k = zones && rows.length >= 5 ? Math.max(1, Math.floor(rows.length * 0.2)) : 0;
  return (
    <>
      {rows.map((p, i) => {
        const gate = RANK_GATES.find((g) => g.rank === p.stats?.rank);
        const zone = k && i < k ? ' zone-up' : k && i >= rows.length - k ? ' zone-down' : '';
        return (
          <Link key={p.id} to={`/u/${p.handle}`} className={`board-row${p.id === me ? ' me' : ''}${zone}`}>
            <span className="board-pos">{i + 1}</span>
            <Avatar url={avatarUrl(p.avatar_path)} name={p.display_name} size={30} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="list-title">{p.display_name}</span>
              <span className="list-sub">
                {' '}
                <b style={{ color: gate?.color }}>{p.stats?.rank}</b> · LV {p.stats?.level} · 🔥{p.stats?.streak}
              </span>
            </span>
            <span className="board-exp">{(p.stats?.weekEp ?? 0).toLocaleString()} EP</span>
          </Link>
        );
      })}
    </>
  );
}

/** Weekly Effort Points: your league, the people you follow, or everyone. */
export function LeagueBoard() {
  const me = useMeId()!;
  const realLeague = useSession((s) => s.profile?.league ?? 0);
  const myLeague = demoNet() ? demo.profile(DEMO_ME).league : realLeague;
  const share = useApp((s) => s.player?.shareStats);
  const today = useToday();
  const week = weekOf(today)[0]!;
  const [scope, setScope] = useState<'league' | 'following' | 'global'>('league');
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const league = leagueOf(myLeague);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    (async () => {
      const s: BoardScope =
        scope === 'global' ? { kind: 'global' } : scope === 'league' ? { kind: 'league', league: myLeague } : { kind: 'following', ids: [me, ...(await followingIds(me))] };
      return leaderboard(s, week);
    })()
      .then((r) => !cancelled && setRows(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [scope, me, week, myLeague]);

  return (
    <Card>
      <Sec>
        <span style={{ color: league.color }}>{league.name.toUpperCase()} LEAGUE</span> · THIS WEEK
      </Sec>
      <Seg
        label="Board"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'league', label: 'MY LEAGUE' },
          { value: 'following', label: 'FOLLOWING' },
          { value: 'global', label: 'GLOBAL' },
        ]}
      />
      {!share && !demoNet() && (
        <p className="hint" style={{ color: 'var(--gold)' }}>
          You're not on the board. Turn on <Link to="/account">Share stats</Link> to compete.
        </p>
      )}
      {rows === null && !error && <p className="hint">Loading…</p>}
      {rows?.length === 0 && <p className="prose muted">No one has posted Effort Points this week yet.</p>}
      {rows && <BoardRows rows={rows} me={me} zones={scope === 'league'} />}
      <ErrorText error={error} />
      <details className="details" style={{ marginTop: 10 }}>
        <summary>How fair scoring works</summary>
        <p className="hint">
          Boards rank <b>Effort Points</b>, not EXP. You score for clearing <i>your own</i> quest (60 points, with partial credit) plus optional training
          measured against <i>your own</i> capacity (up to 30, with diminishing returns), capped at 100 a day. Rank makes your quest harder, not worth
          more, so an E-rank and an S-rank compete evenly. Training muscles that are already strained counts for less.
        </p>
        <p className="hint">
          Leagues: {LEAGUES.map((l) => l.name).join(' → ')}. Each Monday the top 20% of a league move up and the bottom 20% move down (green and red
          edges). Scores are reported by each hunter's app.
        </p>
      </details>
    </Card>
  );
}
