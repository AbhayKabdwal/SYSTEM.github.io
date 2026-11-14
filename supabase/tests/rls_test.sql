-- Row-level security checks. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

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

-- Carol: photo feats. Uploads only into her own folder; photo visibility follows the feat.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into storage.objects (bucket_id, name, owner)
values ('feat-media', '00000000-0000-0000-0000-00000000000c/11111111-1111-1111-1111-111111111111.jpg', '00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('feat-media', '00000000-0000-0000-0000-00000000000a/22222222-2222-2222-2222-222222222222.jpg') $$,
  null, 'cannot upload into someone else''s folder');
select throws_ok(
  $$ insert into public.feats (user_id, kind, title, image_path) values ('00000000-0000-0000-0000-00000000000c', 'proof', 'x', '00000000-0000-0000-0000-00000000000a/33333333-3333-3333-3333-333333333333.jpg') $$,
  null, 'feat cannot point at another user''s photo');
insert into public.feats (user_id, kind, title, visibility, image_path)
values ('00000000-0000-0000-0000-00000000000c', 'proof', 'proof feat', 'followers', '00000000-0000-0000-0000-00000000000c/11111111-1111-1111-1111-111111111111.jpg');
select throws_ok(
  $$ update public.profiles set stats = '{"level": 5, "rank": "Z", "streak": 1, "weekExp": 10, "week": "2026-11-02"}' where id = '00000000-0000-0000-0000-00000000000c' $$,
  null, 'stats must be well-formed');
update public.profiles set stats = '{"level": 5, "rank": "E", "streak": 3, "weekExp": 420, "week": "2026-11-02"}' where id = '00000000-0000-0000-0000-00000000000c';

insert into storage.objects (bucket_id, name, owner)
values ('vault-media', '00000000-0000-0000-0000-00000000000c/p1.bin', '00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('vault-media', '00000000-0000-0000-0000-00000000000a/p2.bin') $$,
  null, 'cannot write into someone else''s private photo folder');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000a/44444444-4444-4444-4444-444444444444.jpg') $$,
  null, 'cannot upload a profile photo for someone else');
select throws_ok(
  $$ update public.profiles set avatar_path = '00000000-0000-0000-0000-00000000000a/44444444-4444-4444-4444-444444444444.jpg' where id = '00000000-0000-0000-0000-00000000000c' $$,
  null, 'profile photo must be in your own folder');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from storage.objects where bucket_id = 'feat-media'), 0, 'non-follower cannot read a followers-only photo');
insert into public.follows (follower, followee) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from storage.objects where bucket_id = 'feat-media'), 1, 'follower can read the photo');
select is((select (stats ->> 'weekExp')::int from public.profiles where handle = 'carol'), 420, 'shared stats are visible');
select is((select count(*)::int from storage.objects where bucket_id = 'vault-media'), 0, 'private photos stay private, even to followers');

-- Guilds: created with the owner as first member, joined only by invite code.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.guilds (name, tag, owner) values ('Night Raid', 'NR', '00000000-0000-0000-0000-00000000000c');
select is((select role from public.guild_members where user_id = '00000000-0000-0000-0000-00000000000c'), 'owner', 'guild creator becomes owner');
select set_config('test.code', (select invite_code from public.guilds where tag = 'NR'), true);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.guilds), 0, 'non-members cannot see a guild');
select public.join_guild(current_setting('test.code'));
select is((select count(*)::int from public.guild_members), 2, 'joining by code shows the roster');
select throws_ok(
  $$ insert into public.guild_members (guild_id, user_id) select id, '00000000-0000-0000-0000-00000000000a' from public.guilds $$,
  null, 'cannot add members directly');
select throws_ok(
  $$ update public.profiles set league = 5 where id = '00000000-0000-0000-0000-00000000000b' $$,
  null, 'players cannot promote themselves');

-- Duels: only the two sides see one, and only the opponent can accept.
insert into public.duels (challenger, opponent) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ select public.respond_duel((select id from public.duels limit 1), true) $$,
  null, 'challenger cannot accept their own duel');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.duels), 1, 'opponent sees the challenge');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.duels), 0, 'outsiders cannot see duels');

-- Boss: everyone sees the total, nobody sees anyone else's hits.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.boss_hits (user_id, month, damage) values ('00000000-0000-0000-0000-00000000000b', '2026-11', 50);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.boss_hits (user_id, month, damage) values ('00000000-0000-0000-0000-00000000000c', '2026-11', 30);
select is((select total::int from public.boss_status('2026-11')), 80, 'boss total adds every hunter');
select is((select count(*)::int from public.boss_hits), 1, 'you only see your own boss hits');

-- Weekly league roll (runs as the database owner via pg_cron): inactive hunters drop a league.
reset role;
update public.profiles set league = 2 where handle = 'alice';
select public.roll_leagues();
select is((select league::int from public.profiles where handle = 'alice'), 1, 'inactive hunters drop a league');

-- Anonymous visitors see nothing.
select set_config('role', 'anon', true);
select is((select count(*)::int from storage.objects where bucket_id = 'feat-media'), 0, 'anon sees no photos');
select is((select count(*)::int from public.feats), 0, 'anon sees no feats');
select is((select count(*)::int from public.profiles), 0, 'anon sees no profiles');

select * from finish();
rollback;
