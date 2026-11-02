-- Row-level security checks. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Three users via the sign-up trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev', '{"handle":"alice","display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev', '{"handle":"bob","display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.dev', '{"handle":"carol","display_name":"Carol"}');

select is((select count(*)::int from public.profiles), 3, 'sign-up trigger creates profiles');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Alice: vault + feats.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.vaults (user_id, iv, ciphertext) values ('00000000-0000-0000-0000-00000000000a', 'iv', 'ct');
insert into public.feats (user_id, kind, title, visibility) values
  ('00000000-0000-0000-0000-00000000000a', 'custom', 'public feat', 'public'),
  ('00000000-0000-0000-0000-00000000000a', 'custom', 'followers feat', 'followers');
select throws_ok(
  $$ insert into public.feats (user_id, kind, title) values ('00000000-0000-0000-0000-00000000000b', 'custom', 'forged') $$,
  null, 'cannot post as someone else');

-- Bob: cannot see Alice's vault, sees only the public feat until he follows.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.vaults), 0, 'vaults are private');
select is((select count(*)::int from public.vault_keys), 0, 'vault keys are private');
select is((select count(*)::int from public.feats), 1, 'non-follower sees only public feats');
insert into public.follows (follower, followee) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.feats), 2, 'follower sees followers-only feats');
select throws_ok(
  $$ insert into public.follows (follower, followee) values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a') $$,
  null, 'cannot follow on behalf of someone else');
insert into public.likes (user_id, feat_id) select '00000000-0000-0000-0000-00000000000b', id from public.feats where title = 'public feat';
select is((select count(*)::int from public.likes), 1, 'can like a visible feat');
update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000a';
select is((select display_name from public.profiles where handle = 'alice'), 'Alice', 'cannot edit another profile');

-- Alice blocks Bob: follow removed, Bob loses sight of Alice and her feats.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.blocks (blocker, blocked) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.follows), 0, 'block severs follows');
select is((select count(*)::int from public.profiles where handle = 'bob'), 1, 'blocker can still see who they blocked');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.feats), 0, 'blocked user sees none of the blocker''s feats');
select is((select count(*)::int from public.profiles where handle = 'alice'), 0, 'blocked user cannot see the blocker''s profile');
select throws_ok(
  $$ insert into public.follows (follower, followee) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a') $$,
  null, 'cannot re-follow across a block');

-- Anonymous visitors see nothing.
select set_config('role', 'anon', true);
select is((select count(*)::int from public.feats), 0, 'anon sees no feats');
select is((select count(*)::int from public.profiles), 0, 'anon sees no profiles');

select * from finish();
rollback;
