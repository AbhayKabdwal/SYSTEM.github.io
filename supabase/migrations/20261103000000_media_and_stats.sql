-- v2.1: photo feats and opt-in leaderboard stats.
--
-- Privacy model additions:
--   * Photos are posted only when the user picks "Followers" or "Global" for them.
--     "Private" photos never leave the device. Posted photos live in a private
--     storage bucket, readable only by people who can see the feat they belong to.
--   * Leaderboard stats (level, rank, streak, weekly EXP) are published only when the
--     user turns on "Share stats". They are self-reported by the client.

-- ── Feats with photos ───────────────────────────────────────────────────────
alter table public.feats
  add column image_path text unique
    check (image_path is null or (image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$' and split_part(image_path, '/', 1) = user_id::text));

alter table public.feats drop constraint feats_kind_check;
alter table public.feats add constraint feats_kind_check
  check (kind in ('rank', 'streak', 'skill', 'monthly', 'milestone', 'quest', 'proof', 'custom'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feat-media', 'feat-media', false, 1048576, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Upload only into your own folder: <your user id>/<uuid>.jpg
create policy "upload feat media to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'feat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Read a photo if you can read the feat that uses it (feats RLS applies inside the
-- subquery), or if it's yours. Anonymous visitors get nothing.
create policy "read feat media when the feat is visible"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'feat-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.feats f where f.image_path = storage.objects.name)
    )
  );

create policy "delete own feat media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'feat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Leaderboard stats ───────────────────────────────────────────────────────
alter table public.profiles
  add column stats jsonb
    check (
      stats is null
      or (
        jsonb_typeof(stats) = 'object'
        and octet_length(stats::text) <= 512
        and (stats ->> 'level')::int between 1 and 100
        and (stats ->> 'rank') in ('E', 'D', 'C', 'B', 'A', 'S')
        and (stats ->> 'streak')::int between 0 and 10000
        and (stats ->> 'weekExp')::int between -100000 and 100000
        and (stats ->> 'week') ~ '^\d{4}-\d{2}-\d{2}$'
      )
    );

create index profiles_week_exp_idx on public.profiles (((stats ->> 'week')), (((stats ->> 'weekExp')::int)) desc)
  where stats is not null;
