import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cloudEnabled } from '../../cloud/client';
import {
  block,
  deleteFeat,
  feed,
  FEED_PAGE,
  followingIds,
  like,
  postFeat,
  report,
  searchProfiles,
  unlike,
  type Feat,
  type FeedScope,
  type Profile,
  type Visibility,
} from '../../cloud/social';
import { achievements, type Achievement } from '../../domain';
import { useApp } from '../../state/store';
import { useSession } from '../../state/session';
import { Card, Dialog, ErrorText, Field, Sec, Seg } from '../../ui/components';
import { timeAgo, useToday } from '../../ui/hooks';
import { toast } from '../../ui/notify';

type Tab = 'following' | 'explore' | 'search';

export function HuntersPage() {
  const user = useSession((s) => s.user);
  const [tab, setTab] = useState<Tab>('following');
  const [composing, setComposing] = useState(false);
  const [reload, setReload] = useState(0);

  if (!cloudEnabled || !user) {
    return (
      <div className="page">
        <Card>
          <Sec>HUNTERS</Sec>
          <p className="prose">Share feats, follow other hunters and cheer them on.</p>
          <p className="prose">
            Sharing is opt-in: nothing from your logs is posted unless you post it yourself, and you choose whether followers or everyone can see it.
          </p>
          {cloudEnabled ? (
            <Link className="btn btn-grn" to="/account" style={{ marginTop: 12 }}>
              SIGN IN TO JOIN
            </Link>
          ) : (
            <p className="hint">Not available in this offline build.</p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn btn-gold" style={{ marginBottom: 12 }} onClick={() => setComposing(true)}>
        ◆ SHARE A FEAT ◆
      </button>
      <Seg
        label="Feed"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'following', label: 'FOLLOWING' },
          { value: 'explore', label: 'EXPLORE' },
          { value: 'search', label: 'FIND HUNTERS' },
        ]}
      />
      {tab === 'search' ? <Search /> : <FeedList key={`${tab}-${reload}`} scopeKind={tab} />}
      {composing && (
        <Composer
          onClose={() => setComposing(false)}
          onPosted={() => {
            setComposing(false);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
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
      <div className="feat-title">{feat.title}</div>
      {feat.body && <div className="feat-body">{feat.body}</div>}
      <div className="feat-actions">
        <button className={`like-btn${feat.likedByMe ? ' on' : ''}`} aria-pressed={feat.likedByMe} onClick={toggleLike}>
          {feat.likedByMe ? '♥' : '♡'} {feat.likeCount}
        </button>
        {mine && <span className="tag">{feat.visibility === 'public' ? 'PUBLIC' : 'FOLLOWERS'}</span>}
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
                  await deleteFeat(feat.id);
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

function Composer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const me = useSession((s) => s.user!.id);
  const { logs, templates } = useApp();
  const today = useToday();
  const options = useMemo(() => achievements(logs, templates, today), [logs, templates, today]);
  const [picked, setPicked] = useState<Achievement | null>(options[0] ?? null);
  const [title, setTitle] = useState(picked?.title ?? '');
  const [body, setBody] = useState(picked?.detail ?? '');
  const [visibility, setVisibility] = useState<Visibility>('followers');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (a: Achievement | null) => {
    setPicked(a);
    setTitle(a?.title ?? '');
    setBody(a?.detail ?? '');
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
      <span className="label">WHO CAN SEE IT</span>
      <Seg
        label="Visibility"
        value={visibility}
        onChange={setVisibility}
        options={[
          { value: 'followers', label: 'FOLLOWERS' },
          { value: 'public', label: 'ALL SIGNED-IN HUNTERS' },
        ]}
      />
      <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
        Only the title and message above are posted. Nothing else from your logs is shared.
      </p>
      <ErrorText error={error} />
      <div className="btn-row">
        <button className="btn" onClick={onClose}>
          CANCEL
        </button>
        <button
          className="btn btn-gold"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await postFeat(me, { kind: picked?.kind ?? 'custom', title: title.trim(), body: body.trim(), visibility });
              toast('FEAT SHARED');
              onPosted();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          POST
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
      <Field label="SEARCH BY HANDLE">
        {(id) => <input id={id} className="inp" autoCapitalize="none" autoCorrect="off" placeholder="jinwoo" value={q} onChange={(e) => setQ(e.target.value)} />}
      </Field>
      {results.map((p) => (
        <Link key={p.id} to={`/u/${p.handle}`} className="list-item">
          <div>
            <div className="list-title">{p.display_name}</div>
            <div className="list-sub">@{p.handle}</div>
          </div>
        </Link>
      ))}
      {q.trim() && !results.length && !error && <p className="hint">No hunters found.</p>}
      <ErrorText error={error} />
    </Card>
  );
}
