-- v3.1: block offensive handles, display names, bios and guild names.
--
-- Same lists and rules as app/src/domain/moderation.ts (a test keeps them in step). The app
-- checks first to show a clear message; this makes it impossible to get around.

create function public.name_problem(t text, kind text default 'name') returns text
language plpgsql immutable set search_path = '' as $$
declare
  block_substr text[] := array[
    'fuck', 'fck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'slut', 'pussy', 'penis', 'vagina', 'porn', 'twat', 'wank',
    'hitler', 'retard', 'rapist', 'asshole', 'dickhead', 'cocksuck', 'motherfuck', 'jerkoff', 'dildo', 'boobs',
    'chutiya', 'chutia', 'madarchod', 'maderchod', 'behenchod', 'bhenchod', 'bhosdi', 'bhosda', 'gaandu', 'gandu', 'lawda', 'harami'
  ];
  block_squeezed text[] := array['fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'pusy', 'fagot', 'chutiya', 'madarchod', 'bhenchod', 'behenchod', 'bhosdi', 'gandu', 'harami', 'ashole'];
  block_words text[] := array['ass', 'dick', 'cock', 'cum', 'sex', 'tit', 'tits', 'fag', 'hoe', 'nazi', 'randi', 'lund', 'lauda', 'kkk', 'stfu', 'gand', 'rape'];
  reserved_handles text[] := array['admin', 'administrator', 'system', 'support', 'moderator', 'mod', 'mods', 'official', 'staff', 'help', 'root', 'owner', 'security', 'null', 'undefined', 'api', 'www'];
  norm text;
  letters text;
  squeezed text;
  w text;
begin
  if t is null then
    return null;
  end if;
  norm := translate(lower(t), '0134578@$!|', 'oieastbasii');
  letters := regexp_replace(norm, '[^a-z]', '', 'g');
  squeezed := regexp_replace(letters, '(.)\1+', '\1', 'g');
  -- Reserved check ignores digits rather than reading them as letters: 'support_1' is 'support'.
  if kind = 'handle' and regexp_replace(lower(t), '[^a-z]', '', 'g') = any (reserved_handles) then
    return 'That handle is reserved.';
  end if;
  foreach w in array block_substr loop
    if position(w in letters) > 0 then return 'That contains a word that isn''t allowed.'; end if;
  end loop;
  foreach w in array block_squeezed loop
    if position(w in squeezed) > 0 then return 'That contains a word that isn''t allowed.'; end if;
  end loop;
  if exists (select 1 from regexp_split_to_table(norm, '[^a-z]+') as tok where tok = any (block_words))
     or (kind <> 'text' and letters = any (block_words)) then
    return 'That contains a word that isn''t allowed.';
  end if;
  return null;
end;
$$;

grant execute on function public.name_problem(text, text) to anon, authenticated;

-- Profiles: handle, display name and bio. Also runs for the sign-up trigger, so an
-- offensive handle can't be created by calling the API directly.
create function public.check_profile_names() returns trigger
language plpgsql set search_path = '' as $$
declare
  p text;
begin
  p := coalesce(public.name_problem(new.handle, 'handle'), public.name_problem(new.display_name, 'name'), public.name_problem(new.bio, 'text'));
  if p is not null then
    raise exception '%', p using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_name_check before insert or update of handle, display_name, bio on public.profiles
  for each row execute function public.check_profile_names();

create function public.check_guild_names() returns trigger
language plpgsql set search_path = '' as $$
declare
  p text;
begin
  p := coalesce(public.name_problem(new.name, 'name'), public.name_problem(new.tag, 'name'));
  if p is not null then
    raise exception '%', p using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger guilds_name_check before insert or update of name, tag on public.guilds
  for each row execute function public.check_guild_names();

-- Sign-up asks this before creating an account, so reserved or offensive handles read as taken.
create or replace function public.handle_available(h text) returns boolean
language sql security definer set search_path = '' stable as $$
  select h ~ '^[a-z0-9_]{3,20}$'
    and public.name_problem(h, 'handle') is null
    and not exists (select 1 from public.profiles where handle = h);
$$;
