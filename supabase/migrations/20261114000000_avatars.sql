-- v2.3: profile photos for the Hunters network.
--
-- A profile photo is shown to other signed-in hunters, like your display name. The
-- bucket is public so feeds can show avatars without signing a URL per row; file names
-- are random, so a photo can only be found through a profile you can already see.
-- Only the owner can upload, replace or delete their photos.

alter table public.profiles
  add column avatar_path text
    check (avatar_path is null or (avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' and split_part(avatar_path, '/', 1) = id::text));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 262144, array['image/jpeg'])
on conflict (id) do nothing;

create policy "avatars: owner uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Needed for the owner to list and remove old photos; public reads go through the CDN URL.
create policy "avatars: owner lists"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
