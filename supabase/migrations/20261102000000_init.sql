-- SYSTEM backend schema.
--
-- Privacy model:
--   * vaults / vault_keys hold only ciphertext and wrapped keys. The server cannot read
--     training logs, body data or settings.
--   * feats are the only plaintext activity data, and only what the user chose to post.
--   * Progress photos never reach the server.
-- Every table has row-level security; the anon key alone can read nothing.

-- ── Profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users edit their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Created from sign-up metadata so a profile always exists for every account.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'handle'),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), new.raw_user_meta_data ->> 'handle')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_available(h text) returns boolean
language sql security definer set search_path = '' stable as $$
  select h ~ '^[a-z0-9_]{3,20}$' and not exists (select 1 from public.profiles where handle = h);
$$;

grant execute on function public.handle_available(text) to anon, authenticated;

-- ── Encrypted vault ─────────────────────────────────────────────────────────
create table public.vaults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  version integer not null default 1,
  iv text not null,
  ciphertext text not null check (octet_length(ciphertext) <= 20 * 1024 * 1024),
  updated_at timestamptz not null default now()
);

create table public.vault_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kdf_iterations integer not null check (kdf_iterations >= 100000),
  pass_salt text not null,
  pass_iv text not null,
  pass_wrapped text not null,
  rec_salt text not null,
  rec_iv text not null,
  rec_wrapped text not null,
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;
alter table public.vault_keys enable row level security;

create policy "own vault only" on public.vaults for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own vault keys only" on public.vault_keys for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Social graph ────────────────────────────────────────────────────────────
create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

alter table public.blocks enable row level security;

create policy "see own blocks" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "block as yourself" on public.blocks for insert to authenticated with check (blocker = auth.uid());
create policy "unblock as yourself" on public.blocks for delete to authenticated using (blocker = auth.uid());

-- Security definer so RLS policies can check blocks in both directions
-- without exposing who has blocked whom.
create function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

create function public.has_blocked(blocker_id uuid, blocked_id uuid) returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.blocks where blocker = blocker_id and blocked = blocked_id);
$$;

-- Someone who blocked you disappears for you. You can still see people you blocked,
-- so you can find them again to unblock.
create policy "profiles are visible to signed-in users, except to people they blocked"
  on public.profiles for select to authenticated
  using (id = auth.uid() or not public.has_blocked(id, auth.uid()));

create table public.follows (
  follower uuid not null references public.profiles (id) on delete cascade,
  followee uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);

create index follows_followee_idx on public.follows (followee);

alter table public.follows enable row level security;

create policy "follow graph visible to signed-in users" on public.follows for select to authenticated
  using (not public.is_blocked_between(auth.uid(), follower) and not public.is_blocked_between(auth.uid(), followee));
create policy "follow as yourself, not across a block" on public.follows for insert to authenticated
  with check (follower = auth.uid() and not public.is_blocked_between(follower, followee));
create policy "unfollow, or remove a follower" on public.follows for delete to authenticated
  using (follower = auth.uid() or followee = auth.uid());

-- Blocking someone also severs follows in both directions.
create function public.sever_follows_on_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
  where (follower = new.blocker and followee = new.blocked)
     or (follower = new.blocked and followee = new.blocker);
  return new;
end;
$$;

create trigger on_block after insert on public.blocks
  for each row execute function public.sever_follows_on_block();

-- ── Feats ───────────────────────────────────────────────────────────────────
create table public.feats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('rank', 'streak', 'skill', 'monthly', 'milestone', 'quest', 'custom')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 280),
  visibility text not null default 'followers' check (visibility in ('public', 'followers')),
  created_at timestamptz not null default now()
);

create index feats_user_created_idx on public.feats (user_id, created_at desc);
create index feats_public_created_idx on public.feats (created_at desc) where visibility = 'public';

alter table public.feats enable row level security;

create policy "read own, public, or followed feats; never across a block"
  on public.feats for select to authenticated
  using (
    user_id = auth.uid()
    or (
      not public.is_blocked_between(auth.uid(), user_id)
      and (
        visibility = 'public'
        or exists (select 1 from public.follows f where f.follower = auth.uid() and f.followee = feats.user_id)
      )
    )
  );

create policy "post as yourself" on public.feats for insert to authenticated with check (user_id = auth.uid());
create policy "delete own feats" on public.feats for delete to authenticated using (user_id = auth.uid());

-- Light spam brake: at most 20 feats per rolling hour.
create function public.limit_feat_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feats where user_id = new.user_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Posting too fast. Try again later.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger feats_rate_limit before insert on public.feats
  for each row execute function public.limit_feat_rate();

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  feat_id uuid not null references public.feats (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, feat_id)
);

create index likes_feat_idx on public.likes (feat_id);

alter table public.likes enable row level security;

-- The feats subquery is itself filtered by feats RLS, so likes on hidden feats stay hidden.
create policy "likes visible on visible feats" on public.likes for select to authenticated
  using (exists (select 1 from public.feats f where f.id = likes.feat_id));
create policy "like visible feats as yourself" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.feats f where f.id = likes.feat_id));
create policy "unlike" on public.likes for delete to authenticated using (user_id = auth.uid());

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles (id) on delete cascade,
  feat_id uuid references public.feats (id) on delete set null,
  reported_user uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Reports are write-only for users; review them in the Supabase dashboard.
create policy "file reports as yourself" on public.reports for insert to authenticated
  with check (reporter = auth.uid());

-- ── Account deletion ────────────────────────────────────────────────────────
-- Deleting the auth user cascades to every table above.
create function public.delete_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
