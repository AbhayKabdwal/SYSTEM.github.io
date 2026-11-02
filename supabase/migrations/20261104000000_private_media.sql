-- v2.2: encrypted backup of private photos (progress photos and Private proofs).
--
-- Files are AES-256-GCM ciphertext made with the user's vault key, the same key as
-- the encrypted vault. The server can't see the images, and only the owner can
-- list, read or delete them. Nobody else, signed in or not, can reach this bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault-media', 'vault-media', false, 2097152, array['application/octet-stream'])
on conflict (id) do nothing;

create policy "vault media: owner reads"
  on storage.objects for select to authenticated
  using (bucket_id = 'vault-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vault media: owner uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'vault-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vault media: owner replaces"
  on storage.objects for update to authenticated
  using (bucket_id = 'vault-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'vault-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vault media: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vault-media' and (storage.foldername(name))[1] = auth.uid()::text);
