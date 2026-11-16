import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cancelDuel, DUEL_DAYS, myDuels, profilesByIds, respondDuel, type Duel } from '../../cloud/competition';
import { duelPhase, duelScore } from '../../cloud/duelScore';
import { avatarUrl, type Profile } from '../../cloud/social';
import { addDays } from '../../domain';
import { useMeId } from '../../cloud/demoHooks';
import { Avatar } from '../../ui/Avatar';
import { Card, ErrorText, Sec } from '../../ui/components';
import { fmtDate, useLedger, useToday } from '../../ui/hooks';
import { toast } from '../../ui/notify';

export function DuelsPanel() {
  const me = useMeId()!;
  const today = useToday();
  const ledger = useLedger();
  const [duels, setDuels] = useState<Duel[] | null>(null);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await myDuels();
      setDuels(d);
      setPeople(await profilesByIds([...new Set(d.flatMap((x) => [x.challenger, x.opponent]))]));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const visible = useMemo(() => (duels ?? []).filter((d) => d.status === 'pending' || d.status === 'active'), [duels]);
  const wins = (duels ?? []).filter((d) => duelPhase(d, today) === 'over' && winner(d) === me).length;

  return (
    <Card>
      <Sec>DUELS</Sec>
      <p className="hint" style={{ marginTop: -4 }}>
        7 days, most Effort Points wins. Challenge someone from their profile. {wins ? `You've won ${wins}.` : ''}
      </p>
      {duels === null && !error && <p className="hint">Loading…</p>}
      {duels && !visible.length && <p className="prose muted">No duels yet. Open a hunter's profile and tap CHALLENGE.</p>}
      {visible.map((d) => {
        const mine = d.challenger === me;
        const other = people.get(mine ? d.opponent : d.challenger);
        const phase = duelPhase(d, today);
        const myScore = phase === 'live' || phase === 'settling' ? duelScore(ledger, d) : mine ? d.challenger_score : d.opponent_score;
        const theirScore = mine ? d.opponent_score : d.challenger_score;
        const w = winner(d);
        return (
          <div className="duel-row" key={d.id}>
            <div className="duel-vs">
              <div>
                <div className="hint">YOU</div>
                <div className="score">{myScore}</div>
              </div>
              <div className="label" style={{ margin: 0 }}>
                VS
              </div>
              <Link to={other ? `/u/${other.handle}` : '#'} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Avatar url={avatarUrl(other?.avatar_path)} name={other?.display_name ?? '?'} size={28} />
                <div className="hint">{other?.display_name ?? 'Hunter'}</div>
                <div className="score">{phase === 'waiting' ? '–' : theirScore}</div>
              </Link>
            </div>
            <div className="hint" style={{ textAlign: 'center', marginTop: 4 }}>
              {phase === 'waiting' && (mine ? 'Waiting for them to accept.' : 'They challenged you.')}
              {phase === 'upcoming' && `Starts ${fmtDate(d.starts_on!)}.`}
              {phase === 'live' && `Live until ${fmtDate(addDays(d.starts_on!, DUEL_DAYS - 1))}. Their score updates when their app syncs.`}
              {phase === 'settling' && 'Finished. Final scores come in over the next two days.'}
              {phase === 'over' && (w === null ? 'Draw.' : w === me ? '🏆 You won! Title: Duel Champion.' : 'They won this one.')}
            </div>
            {phase === 'waiting' && (
              <div className="btn-row" style={{ marginTop: 6 }}>
                {mine ? (
                  <button className="btn btn-sm" onClick={() => void act(() => cancelDuel(d.id), 'DUEL CANCELLED')}>
                    CANCEL
                  </button>
                ) : (
                  <>
                    <button className="btn btn-sm" onClick={() => void act(() => respondDuel(d.id, false), 'DECLINED')}>
                      DECLINE
                    </button>
                    <button className="btn btn-sm btn-gold" onClick={() => void act(() => respondDuel(d.id, true), 'DUEL ACCEPTED: STARTS TOMORROW')}>
                      ACCEPT
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      <ErrorText error={error} />
    </Card>
  );

  async function act(fn: () => Promise<void>, msg: string) {
    try {
      await fn();
      toast(msg);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
}

/** Winner id once scores are final, null for a draw. */
export function winner(d: Duel): string | null {
  if (d.challenger_score === d.opponent_score) return null;
  return d.challenger_score > d.opponent_score ? d.challenger : d.opponent;
}
