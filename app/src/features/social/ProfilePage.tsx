import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RANK_GATES } from '../../domain';
import { block, follow, followCounts, followingIds, profileByHandle, unfollow, type Profile } from '../../cloud/social';
import { useSession } from '../../state/session';
import { Card, ErrorText, Sec } from '../../ui/components';
import { toast } from '../../ui/notify';
import { FeedList, ReportButton } from './HuntersPage';

export function ProfilePage() {
  const { handle = '' } = useParams();
  const me = useSession((s) => s.user?.id);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    (async () => {
      try {
        const p = await profileByHandle(handle);
        if (!alive) return;
        setProfile(p);
        if (p) {
          const [c, f] = await Promise.all([followCounts(p.id), followingIds(me)]);
          if (!alive) return;
          setCounts(c);
          setIsFollowing(f.has(p.id));
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [handle, me]);

  if (!me) {
    return (
      <div className="page">
        <Card>
          <p className="prose">Sign in to view hunter profiles.</p>
          <Link className="btn" to="/account" style={{ marginTop: 12 }}>
            SIGN IN
          </Link>
        </Card>
      </div>
    );
  }
  if (profile === undefined) return <div className="page">{error ? <ErrorText error={error} /> : <p className="hint">Loading…</p>}</div>;
  if (!profile) {
    return (
      <div className="page">
        <Card>
          <p className="prose">No hunter called @{handle}.</p>
        </Card>
      </div>
    );
  }

  const isMe = profile.id === me;
  const toggleFollow = async () => {
    try {
      if (isFollowing) await unfollow(me, profile.id);
      else await follow(me, profile.id);
      setIsFollowing(!isFollowing);
      setCounts((c) => ({ ...c, followers: c.followers + (isFollowing ? -1 : 1) }));
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div className="page">
      <Card>
        <div className="rank-name">{profile.display_name}</div>
        <div className="muted" style={{ marginTop: 2 }}>
          @{profile.handle}
        </div>
        {profile.bio && (
          <p className="prose" style={{ marginTop: 10 }}>
            {profile.bio}
          </p>
        )}
        {profile.stats && (
          <div className="profile-stats">
            <span className="rank-badge-sm" style={{ color: RANK_GATES.find((g) => g.rank === profile.stats!.rank)?.color }}>
              {profile.stats.rank}
            </span>
            <span>LVL {profile.stats.level}</span>
            <span>🔥 {profile.stats.streak}</span>
            <span>+{profile.stats.weekExp.toLocaleString()} EXP this week</span>
          </div>
        )}
        <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
          <div className="stat-card">
            <div className="stat-val">{counts.followers}</div>
            <div className="stat-lbl">FOLLOWERS</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{counts.following}</div>
            <div className="stat-lbl">FOLLOWING</div>
          </div>
        </div>
        {isMe ? (
          <Link className="btn" to="/account">
            EDIT PROFILE
          </Link>
        ) : (
          <>
            <button className={`btn ${isFollowing ? '' : 'btn-grn'}`} onClick={toggleFollow}>
              {isFollowing ? 'UNFOLLOW' : 'FOLLOW'}
            </button>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <ReportButton me={me} target={{ userId: profile.id }} onDone={() => undefined} />
              <button
                className="btn btn-red"
                onClick={async () => {
                  if (!confirm(`Block @${profile.handle}?`)) return;
                  await block(me, profile.id);
                  toast('BLOCKED');
                  navigate('/hunters');
                }}
              >
                BLOCK
              </button>
            </div>
          </>
        )}
      </Card>
      <Sec>FEATS</Sec>
      <FeedList scopeKind="user" userId={profile.id} />
    </div>
  );
}
