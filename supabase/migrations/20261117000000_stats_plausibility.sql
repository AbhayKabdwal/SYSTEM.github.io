-- v3.3: reject impossible leaderboard stats.
--
-- Stats are reported by each player's app (the server can't read the encrypted logs), so
-- they can't be proven. This stops the obvious fakes: a level or streak that couldn't be
-- reached since the player's first logged day ("since"), which the app also reports.
-- The bounds are far looser than real play (level 100 takes years), so honest players
-- never hit them.

create function public.check_stats_plausible() returns trigger
language plpgsql set search_path = '' as $$
declare
  st jsonb := new.stats;
  since date;
  days int;
begin
  if st is null then
    return new;
  end if;
  since := coalesce(nullif(st ->> 'since', '')::date, new.created_at::date);
  if since > current_date + 1 or since < date '2015-01-01' then
    raise exception 'Stats rejected: first day is out of range.' using errcode = 'P0001';
  end if;
  days := greatest(1, current_date - since + 1);
  if (st ->> 'level')::int > 4 + days / 2 then
    raise exception 'Stats rejected: that level is not reachable in % days.', days using errcode = 'P0001';
  end if;
  if (st ->> 'streak')::int > days + 1 then
    raise exception 'Stats rejected: the streak is longer than the history.' using errcode = 'P0001';
  end if;
  if coalesce((st ->> 'weekEp')::int, 0) > 100 * least(7, days) then
    raise exception 'Stats rejected: more Effort Points than days allow.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_stats_plausible before insert or update of stats on public.profiles
  for each row execute function public.check_stats_plausible();
