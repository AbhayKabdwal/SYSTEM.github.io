-- v3: competition. Guilds, duels, weekly leagues and the monthly boss.
--
-- Scores are Effort Points (EP), reported by each player's app. EP measures how much of
-- your *own* quest you cleared, so ranks compete fairly. Like the leaderboard, it's
-- self-reported: treat it as a game, not a record.

-- ── Profiles: richer stats, a league, and column-level write access ─────────
alter table public.profiles drop constraint if exists profiles_stats_check;
alter table public.profiles add constraint profiles_stats_check check (
  stats is null
  or (
    jsonb_typeof(stats) = 'object'
    and octet_length(stats::text) <= 1024
    and (stats ->> 'level')::int between 1 and 100
    and (stats ->> 'rank') in ('E', 'D', 'C', 'B', 'A', 'S')
    and (stats ->> 'streak')::int between 0 and 10000
    and (stats ->> 'weekExp')::int between -100000 and 100000
    and coalesce((stats ->> 'weekEp')::int, 0) between 0 and 700
    and (stats ->> 'week') ~ '^\d{4}-\d{2}-\d{2}$'
  )
);

-- 0 Bronze, 1 Silver, 2 Gold, 3 Platinum, 4 Diamond, 5 Monarch. Moved only by roll_leagues().
alter table public.profiles add column league smallint not null default 0 check (league between 0 and 5);

-- Users may edit only these columns of their own profile; handle and league are system-managed.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, stats, avatar_path) on public.profiles to authenticated;

-- Weekly: the top 20% of each league (by last week's EP) move up, the bottom 20% move down.
-- Hunters who posted nothing last week drop one league. Leagues under 5 players hold still.
create function public.roll_leagues() returns void
language plpgsql security definer set search_path = '' as $$
declare
  prev_week text := to_char(current_date - extract(isodow from current_date)::int + 1 - 7, 'YYYY-MM-DD');
  l int;
  n int;
  k int;
begin
  update public.profiles set league = greatest(league - 1, 0)
  where league > 0 and (stats is null or stats ->> 'week' < prev_week);

  for l in 0..5 loop
    select count(*) into n from public.profiles where league = l and stats ->> 'week' = prev_week;
    continue when n < 5;
    k := greatest(1, floor(n * 0.2));
    with ranked as (
      select id, row_number() over (order by coalesce((stats ->> 'weekEp')::int, 0) desc, id) as pos
      from public.profiles where league = l and stats ->> 'week' = prev_week
    )
    update public.profiles p set league = case
        when r.pos <= k and l < 5 then l + 1
        when r.pos > n - k and l > 0 then l - 1
        else l end
    from ranked r where p.id = r.id;
  end loop;
end;
$$;

revoke execute on function public.roll_leagues() from public, anon, authenticated;

-- Schedule it Monday 06:00 UTC if pg_cron is available (it is on Supabase; enable it under
-- Database → Extensions if this notice appears). Without it, leagues simply don't move.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('roll-leagues', '0 6 * * 1', 'select public.roll_leagues()');
exception when others then
  raise notice 'pg_cron unavailable (%); leagues will not roll automatically', sqlerrm;
end;
$$;

-- ── Guilds ───────────────────────────────────────────────────────────────────
create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 30),
  tag text not null check (tag ~ '^[A-Z0-9]{2,5}$'),
  owner uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.guild_members (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create index guild_members_user_idx on public.guild_members (user_id);

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;

create function public.is_guild_member(g uuid, u uuid) returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.guild_members where guild_id = g and user_id = u);
$$;

create policy "guilds: members see their guilds" on public.guilds for select to authenticated
  using (public.is_guild_member(id, auth.uid()));
create policy "guilds: create as owner" on public.guilds for insert to authenticated
  with check (owner = auth.uid());
create policy "guilds: owner renames" on public.guilds for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "guilds: owner disbands" on public.guilds for delete to authenticated
  using (owner = auth.uid());

create policy "members: visible to fellow members" on public.guild_members for select to authenticated
  using (public.is_guild_member(guild_id, auth.uid()));
-- Leave (members), or remove someone (owner). The owner leaves by disbanding.
create policy "members: leave or be removed" on public.guild_members for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or exists (select 1 from public.guilds g where g.id = guild_id and g.owner = auth.uid() and user_id <> auth.uid())
  );
-- No insert policy: joining goes through join_guild() so codes and limits are enforced.

create function public.add_guild_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.guild_members where user_id = new.owner) >= 5 then
    raise exception 'You can be in at most 5 guilds.' using errcode = 'P0001';
  end if;
  insert into public.guild_members (guild_id, user_id, role) values (new.id, new.owner, 'owner');
  return new;
end;
$$;

create trigger on_guild_created after insert on public.guilds
  for each row execute function public.add_guild_owner();

create function public.join_guild(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  g public.guilds;
begin
  select * into g from public.guilds where invite_code = upper(trim(code));
  if g.id is null then
    raise exception 'No guild with that invite code.' using errcode = 'P0001';
  end if;
  if public.is_guild_member(g.id, auth.uid()) then
    return g.id;
  end if;
  if public.is_blocked_between(auth.uid(), g.owner) then
    raise exception 'No guild with that invite code.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.guild_members where guild_id = g.id) >= 30 then
    raise exception 'This guild is full (30 members).' using errcode = 'P0001';
  end if;
  if (select count(*) from public.guild_members where user_id = auth.uid()) >= 5 then
    raise exception 'You can be in at most 5 guilds.' using errcode = 'P0001';
  end if;
  insert into public.guild_members (guild_id, user_id) values (g.id, auth.uid());
  return g.id;
end;
$$;

revoke execute on function public.join_guild(text) from public, anon;
grant execute on function public.join_guild(text) to authenticated;

-- ── Duels ────────────────────────────────────────────────────────────────────
create table public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references public.profiles (id) on delete cascade,
  opponent uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'cancelled')),
  -- Seven days from the day after it's accepted.
  starts_on date,
  challenger_score int not null default 0 check (challenger_score between 0 and 700),
  opponent_score int not null default 0 check (opponent_score between 0 and 700),
  created_at timestamptz not null default now(),
  check (challenger <> opponent)
);

create index duels_challenger_idx on public.duels (challenger);
create index duels_opponent_idx on public.duels (opponent);

alter table public.duels enable row level security;

create policy "duels: participants see them" on public.duels for select to authenticated
  using (auth.uid() in (challenger, opponent));
create policy "duels: challenge as yourself" on public.duels for insert to authenticated
  with check (
    challenger = auth.uid() and status = 'pending' and starts_on is null
    and challenger_score = 0 and opponent_score = 0
    and not public.is_blocked_between(challenger, opponent)
  );
-- No update policy: responses and scores go through the functions below.

create function public.limit_open_duels() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.duels
      where new.challenger in (challenger, opponent) and status in ('pending', 'active')
        and (starts_on is null or starts_on + 9 >= current_date)) >= 5 then
    raise exception 'You already have 5 open duels.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger duels_limit before insert on public.duels
  for each row execute function public.limit_open_duels();

create function public.respond_duel(duel uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.duels
  set status = case when accept then 'active' else 'declined' end,
      starts_on = case when accept then current_date + 1 else null end
  where id = duel and opponent = auth.uid() and status = 'pending';
  if not found then
    raise exception 'That duel is no longer waiting for you.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.cancel_duel(duel uuid) returns void
language sql security definer set search_path = '' as $$
  update public.duels set status = 'cancelled' where id = duel and challenger = auth.uid() and status = 'pending';
$$;

-- Each side reports only their own score, during the duel and up to two days after.
create function public.report_duel_score(duel uuid, score int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.duels
  set challenger_score = case when challenger = auth.uid() then least(greatest(score, 0), 700) else challenger_score end,
      opponent_score = case when opponent = auth.uid() then least(greatest(score, 0), 700) else opponent_score end
  where id = duel and status = 'active' and auth.uid() in (challenger, opponent)
    and current_date between starts_on and starts_on + 8;
end;
$$;

revoke execute on function public.respond_duel(uuid, boolean), public.cancel_duel(uuid), public.report_duel_score(uuid, int) from public, anon;
grant execute on function public.respond_duel(uuid, boolean), public.cancel_duel(uuid), public.report_duel_score(uuid, int) to authenticated;

-- ── Monthly boss ─────────────────────────────────────────────────────────────
create table public.boss_hits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  -- At most 25 hard sets a day count, so a month tops out at 775.
  damage int not null check (damage between 0 and 775),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.boss_hits enable row level security;

create policy "boss: own row" on public.boss_hits for select to authenticated using (user_id = auth.uid());
create policy "boss: hit as yourself" on public.boss_hits for insert to authenticated with check (user_id = auth.uid());
create policy "boss: update own hits" on public.boss_hits for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Totals only: nobody sees anyone else's contribution.
create function public.boss_status(m text) returns table (total bigint, participants bigint)
language sql security definer set search_path = '' stable as $$
  select coalesce(sum(damage), 0), count(*) from public.boss_hits where month = m and damage > 0;
$$;

revoke execute on function public.boss_status(text) from public, anon;
grant execute on function public.boss_status(text) to authenticated;
