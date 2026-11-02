import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cloudEnabled } from '../../cloud/client';
import {
  block,
  deleteFeat,
  feed,
  FEED_PAGE,
  followingIds,
  leaderboard,
  like,
  postFeat,
  report,
  searchProfiles,
  unlike,
  type Feat,
  type BoardScope,
  type FeedScope,
  type Profile,
} from '../../cloud/social';
import { achievements, RANK_GATES, weekOf, type Achievement, type Visibility } from '../../domain';
import { createRepo, uid } from '../../data/repo';
import { useApp } from '../../state/store';
import { useSession } from '../../state/session';
import { Card, Dialog, ErrorText, Field, Sec, Seg } from '../../ui/components';
import { compressImage } from '../../ui/image';
import { timeAgo, useLedger, usePhotoUrl, useToday } from '../../ui/hooks';
import { toast } from '../../ui/notify';

type Tab = 'following' | 'explore' | 'ranks';

const repo = createRepo();
const JOURNAL_KEY = 'journal';

/** A private feat: stays in this device's database, never synced or uploaded. */
export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  photoId: string | null;
  createdAt: string;
}

function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const reload = useCallback(() => void repo.getSetting<JournalEntry[]>(JOURNAL_KEY).then((e) => setEntries(e ?? [])), []);
  useEffect(reload, [reload]);
  const save = async (next: JournalEntry[]) => {
    await repo.putSetting(JOURNAL_KEY, next);
    setEntries(next);
  };
  return { entries, reload, save };
}

export function HuntersPage() {
  const user = useSession((s) => s.user);
  const [tab, setTab] = useState<Tab>('following');
  const [composing, setComposing] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [reload, setReload] = useState(0);
  const journal = useJournal();
  const online = cloudEnabled && !!user;

  return (
    <div className="page">
      <button className="btn btn-gold" style={{ marginBottom: 8 }} onClick={() => setComposing(true)}>
        ◆ SHARE A FEAT ◆
      </button>
      <button className="btn btn-sm" style={{ marginBottom: 12 }} onClick={() => setShowJournal((v) => !v)} aria-expanded={showJournal}>
        🔒 MY PRIVATE FEATS ({journal.entries.length})
      </button>
      {showJournal && <Journal entries={journal.entries} onChange={journal.save} />}

      {!online ? (
        <Card>
          <Sec>HUNTERS NETWORK</Sec>
          <p className="prose">Follow other hunters, like their feats and climb the weekly leaderboard.</p>
          <p className="prose">
            Sharing is opt-in: every feat and photo is Private, Followers or Global, chosen by you. Private ones never leave this device.
          </p>
          {cloudEnabled ? (
            <Link className="btn btn-grn" to="/account" style={{ marginTop: 12 }}>
              SIGN IN TO JOIN
            </Link>
          ) : (
            <p className="hint">The network isn't available in this offline build. Private feats still work.</p>
          )}
        </Card>
      ) : (
        <>
          <Search />
          <Seg
            label="Feed"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'following', label: 'FOLLOWING' },
              { value: 'explore', label: 'GLOBAL' },
              { value: 'ranks', label: 'RANKS' },
            ]}
          />
          {tab === 'ranks' ? <Leaderboard /> : <FeedList key={`${tab}-${reload}`} scopeKind={tab} />}
        </>
      )}
      {composing && (
        <Composer
          online={online}
          onClose={() => setComposing(false)}
          onPosted={(vis) => {
            setComposing(false);
            if (vis === 'private') {
              journal.reload();
              setShowJournal(true);
            } else setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function Journal({ entries, onChange }: { entries: JournalEntry[]; onChange: (e: JournalEntry[]) => Promise<void> }) {
  return (
    <Card className="feed">
      <Sec>PRIVATE FEATS · THIS DEVICE ONLY</Sec>
      {!entries.length && <p className="prose muted">Nothing yet. Pick Private when sharing a feat to keep it just for you.</p>}
      {entries.map((e) => (
        <article className="feat" key={e.id} style={{ margin: '0 -14px' }}>
          <div className="feat-head">
            <span className="tag">PRIVATE</span>
            <span className="feat-time">{timeAgo(e.createdAt)}</span>
          </div>
          <div className="feat-title">{e.title}</div>
          {e.body && <div className="feat-body">{e.body}</div>}
          <LocalPhoto id={e.photoId} />
          <div className="feat-actions">
            <span style={{ flex: 1 }} />
            <button
              className="link-btn"
              onClick={async () => {
                if (!confirm('Delete this private feat?')) return;
                if (e.photoId) await repo.deletePhoto(e.photoId);
                await onChange(entries.filter((x) => x.id !== e.id));
              }}
            >
              delete
            </button>
          </div>
        </article>
      ))}
    </Card>
  );
}

function LocalPhoto({ id }: { id: string | null }) {
  const url = usePhotoUrl(id);
  return url ? <img className="feat-img" src={url} alt="" /> : null;
}

function Leaderboard() {
  const me = useSession((s) => s.user!.id);
  const share = useApp((s) => s.player?.shareStats);
  const today = useToday();
  const week = weekOf(today)[0]!;
  const [scope, setScope] = useState<'following' | 'global'>('following');
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    (async () => {
      const s: BoardScope = scope === 'global' ? { kind: 'global' } : { kind: 'following', ids: [me, ...(await followingIds(me))] };
      return leaderboard(s, week);
    })()
      .then((r) => !cancelled && setRows(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [scope, me, week]);

  return (
    <Card>
      <Sec>WEEKLY EXP LEADERBOARD</Sec>
      <Seg
        label="Leaderboard scope"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'following', label: 'YOU + FOLLOWING' },
          { value: 'global', label: 'GLOBAL' },
        ]}
      />
      {!share && (
        <p className="hint">
          You're not on the board. Turn on <Link to="/account">Share stats</Link> to appear.
        </p>
      )}
      {rows === null && !error && <p className="hint">Loading…</p>}
      {rows?.length === 0 && <p className="prose muted">No one has posted stats this week yet.</p>}
      {rows?.map((p, i) => {
        const gate = RANK_GATES.find((g) => g.rank === p.stats?.rank);
        return (
          <Link key={p.id} to={`/u/${p.handle}`} className={`board-row${p.id === me ? ' me' : ''}`}>
            <span className="board-pos">{i + 1}</span>
            <span className="rank-badge-sm" style={{ color: gate?.color }}>
              {p.stats?.rank}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="list-title">{p.display_name}</span>
              <span className="list-sub">
                {' '}
                LVL {p.stats?.level} · 🔥{p.stats?.streak}
              </span>
            </span>
            <span className="board-exp">{p.stats?.weekExp.toLocaleString()}</span>
          </Link>
        );
      })}
      <ErrorText error={error} />
      <p className="hint" style={{ marginTop: 8 }}>
        Stats are reported by each hunter's app.
      </p>
    </Card>
  );
}

export function FeedList({ scopeKind, userId }: { scopeKind: 'following' | 'explore' | 'user'; userId?: string }) {
  const me = useSession((s) => s.user!.id);
  const [items, setItems] = useState<Feat[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scope = useCallback(async (): Promise<FeedScope> => {
    if (scopeKind === 'user') return { kind: 'user', userId: userId! };
    if (scopeKind === 'explore') return { kind: 'explore' };
    return { kind: 'following', me, following: [...(await followingIds(me))] };
  }, [scopeKind, userId, me]);

  const load = useCallback(
    async (before?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await feed(me, await scope(), before);
        setItems((cur) => (before ? [...cur, ...page] : page));
        setDone(page.length < FEED_PAGE);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [me, scope],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const update = (id: string, patch: Partial<Feat> | null) => setItems((cur) => (patch ? cur.map((f) => (f.id === id ? { ...f, ...patch } : f)) : cur.filter((f) => f.id !== id)));

  return (
    <Card className="feed">
      <div style={{ margin: -14 }}>
        {items.map((f) => (
          <FeatCard key={f.id} feat={f} me={me} onChange={(p) => update(f.id, p)} />
        ))}
      </div>
      {!loading && !items.length && !error && (
        <p className="prose muted" style={{ textAlign: 'center' }}>
          {scopeKind === 'following' ? 'Nothing yet. Share a feat, or find hunters to follow.' : 'No feats to show.'}
        </p>
      )}
      <ErrorText error={error} />
      {loading && <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>Loading…</p>}
      {!loading && !done && items.length > 0 && (
        <button className="btn btn-sm" style={{ marginTop: 26 }} onClick={() => void load(items[items.length - 1]!.created_at)}>
          LOAD MORE
        </button>
      )}
    </Card>
  );
}

function FeatCard({ feat, me, onChange }: { feat: Feat; me: string; onChange: (patch: Partial<Feat> | null) => void }) {
  const [menu, setMenu] = useState(false);
  const mine = feat.user_id === me;

  const toggleLike = async () => {
    const next = !feat.likedByMe;
    onChange({ likedByMe: next, likeCount: feat.likeCount + (next ? 1 : -1) });
    try {
      await (next ? like(me, feat.id) : unlike(me, feat.id));
    } catch {
      onChange({ likedByMe: feat.likedByMe, likeCount: feat.likeCount });
      toast('COULD NOT UPDATE LIKE');
    }
  };

  return (
    <article className="feat">
      <div className="feat-head">
        <Link className="feat-author" to={`/u/${feat.author.handle}`}>
          {feat.author.display_name} <span className="muted">@{feat.author.handle}</span>
        </Link>
        <span className="feat-time">{timeAgo(feat.created_at)}</span>
      </div>
      <div className="feat-title">
        {feat.kind === 'proof' && <span className="tag proof-tag">PROOF</span>} {feat.title}
      </div>
      {feat.body && <div className="feat-body">{feat.body}</div>}
      {feat.imageUrl && <img className="feat-img" src={feat.imageUrl} alt={`Photo from @${feat.author.handle}`} loading="lazy" />}
      <div className="feat-actions">
        <button className={`like-btn${feat.likedByMe ? ' on' : ''}`} aria-pressed={feat.likedByMe} onClick={toggleLike}>
          {feat.likedByMe ? '♥' : '♡'} {feat.likeCount}
        </button>
        {mine && <span className="tag">{feat.visibility === 'public' ? 'GLOBAL' : 'FOLLOWERS'}</span>}
        <span style={{ flex: 1 }} />
        <button className="link-btn" onClick={() => setMenu(true)} aria-label="More actions">
          •••
        </button>
      </div>
      {menu && (
        <Dialog title="FEAT" onClose={() => setMenu(false)}>
          <div className="stack">
            {mine ? (
              <button
                className="btn btn-red"
                onClick={async () => {
                  await deleteFeat(feat.id, feat.image_path);
                  onChange(null);
                  setMenu(false);
                  toast('FEAT DELETED');
                }}
              >
                DELETE
              </button>
            ) : (
              <>
                <ReportButton me={me} target={{ featId: feat.id, userId: feat.user_id }} onDone={() => setMenu(false)} />
                <button
                  className="btn btn-red"
                  onClick={async () => {
                    if (!confirm(`Block @${feat.author.handle}? You won't see each other's feats or profiles, and any follows are removed.`)) return;
                    await block(me, feat.user_id);
                    onChange(null);
                    setMenu(false);
                    toast('BLOCKED');
                  }}
                >
                  BLOCK @{feat.author.handle}
                </button>
              </>
            )}
            <button className="btn" onClick={() => setMenu(false)}>
              CLOSE
            </button>
          </div>
        </Dialog>
      )}
    </article>
  );
}

export function ReportButton({ me, target, onDone }: { me: string; target: { featId?: string; userId?: string }; onDone: () => void }) {
  return (
    <button
      className="btn btn-gold"
      onClick={async () => {
        const reason = prompt('What is wrong with this? (spam, abuse, unsafe advice…)');
        if (!reason?.trim()) return;
        try {
          await report(me, target, reason.trim().slice(0, 500));
          toast('REPORT SENT');
          onDone();
        } catch {
          toast('REPORT FAILED');
        }
      }}
    >
      REPORT
    </button>
  );
}

function Composer({ online, onClose, onPosted }: { online: boolean; onClose: () => void; onPosted: (v: Visibility) => void }) {
  const me = useSession((s) => s.user?.id);
  const { logs, templates } = useApp();
  const ledger = useLedger();
  const today = useToday();
  const options = useMemo(() => achievements(ledger, logs, templates, today), [ledger, logs, templates, today]);
  const [picked, setPicked] = useState<Achievement | null>(options[0] ?? null);
  const [title, setTitle] = useState(picked?.title ?? '');
  const [body, setBody] = useState(picked?.detail ?? '');
  const [visibility, setVisibility] = useState<Visibility>(online ? 'followers' : 'private');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const choose = (a: Achievement | null) => {
    setPicked(a);
    setTitle(a?.title ?? '');
    setBody(a?.detail ?? '');
  };

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      if (visibility === 'private') {
        const photoId = photo ? await repo.putPhoto(photo) : null;
        const entries = (await repo.getSetting<JournalEntry[]>(JOURNAL_KEY)) ?? [];
        await repo.putSetting(JOURNAL_KEY, [{ id: uid(), title: title.trim(), body: body.trim(), photoId, createdAt: new Date().toISOString() }, ...entries]);
        toast('SAVED PRIVATELY');
      } else {
        await postFeat(me!, { kind: picked?.kind ?? 'custom', title: title.trim(), body: body.trim(), visibility }, photo ?? undefined);
        toast('FEAT SHARED');
      }
      onPosted(visibility);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="SHARE A FEAT" onClose={onClose}>
      <span className="label">PICK AN ACHIEVEMENT</span>
      <div className="stack" style={{ marginBottom: 12 }}>
        {options.map((a) => (
          <button key={a.key} className="list-item" style={{ marginBottom: 0, borderColor: picked?.key === a.key ? 'var(--gold)' : undefined }} onClick={() => choose(a)}>
            <div>
              <div className="list-title">{a.title}</div>
              <div className="list-sub">{a.detail}</div>
            </div>
          </button>
        ))}
        <button className="list-item" style={{ marginBottom: 0, borderColor: picked === null ? 'var(--gold)' : undefined }} onClick={() => choose(null)}>
          <div className="list-title">Write your own</div>
        </button>
      </div>
      <Field label="TITLE">{(id) => <input id={id} className="inp" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
      <Field label="MESSAGE (OPTIONAL)" hint={`${body.length}/280`}>
        {(id) => <textarea id={id} className="inp" maxLength={280} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <span className="label">PHOTO (OPTIONAL)</span>
      {preview ? (
        <div style={{ marginBottom: 12 }}>
          <img className="feat-img" src={preview} alt="Selected photo" />
          <button
            className="link-btn"
            onClick={() => {
              setPhoto(null);
              setPreview(null);
            }}
          >
            remove photo
          </button>
        </div>
      ) : (
        <button className="btn btn-sm" style={{ marginBottom: 12 }} onClick={() => fileRef.current?.click()}>
          📷 ADD PHOTO
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const blob = await compressImage(f);
            setPhoto(blob);
            setPreview(URL.createObjectURL(blob));
          } catch {
            setError('Could not read that image.');
          }
        }}
      />
      <span className="label">WHO CAN SEE IT</span>
      <Seg
        label="Visibility"
        value={visibility}
        onChange={(v) => (v === 'private' || online ? setVisibility(v) : setError('Sign in to share with followers or globally.'))}
        options={[
          { value: 'private', label: 'PRIVATE' },
          { value: 'followers', label: 'FOLLOWERS' },
          { value: 'public', label: 'GLOBAL' },
        ]}
      />
      <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
        {visibility === 'private'
          ? 'Kept on this device only. Never uploaded or synced.'
          : visibility === 'followers'
            ? 'Hunters who follow you. Only the title, message and photo are posted.'
            : 'Every signed-in hunter, in the Global feed. Only the title, message and photo are posted.'}
        {photo && visibility !== 'private' ? ' Photos are re-encoded, which strips location and camera data.' : ''}
      </p>
      <ErrorText error={error} />
      <div className="btn-row">
        <button className="btn" onClick={onClose}>
          CANCEL
        </button>
        <button className="btn btn-gold" disabled={busy || !title.trim()} onClick={post}>
          {busy ? 'POSTING…' : visibility === 'private' ? 'SAVE' : 'POST'}
        </button>
      </div>
    </Dialog>
  );
}

function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchProfiles(q)
        .then((r) => {
          setResults(r);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Card>
      <Field label="FIND HUNTERS">
        {(id) => (
          <input
            id={id}
            className="inp"
            type="search"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Search by username or name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
      </Field>
      {results.map((p) => (
        <Link key={p.id} to={`/u/${p.handle}`} className="list-item">
          <div style={{ flex: 1 }}>
            <div className="list-title">{p.display_name}</div>
            <div className="list-sub">@{p.handle}</div>
          </div>
          {p.stats && (
            <span className="rank-badge-sm" style={{ color: RANK_GATES.find((g) => g.rank === p.stats!.rank)?.color }}>
              {p.stats.rank}
            </span>
          )}
        </Link>
      ))}
      {q.trim() && !results.length && !error && <p className="hint">No hunters found.</p>}
      <ErrorText error={error} />
    </Card>
  );
}
