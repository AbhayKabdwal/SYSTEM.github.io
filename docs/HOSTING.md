# Hosting SYSTEM

The app has two parts:

| Part | What it is | Where it runs | Cost |
|---|---|---|---|
| Frontend | Static React PWA (`app/`) | GitHub Pages, built by GitHub Actions | Free |
| Backend (optional) | Postgres + auth + row-level security (`supabase/`) | Supabase | Free tier |

Without the backend the app still works fully: logs, muscle map, EXP, backups. It just has no accounts, sync or Hunters network. You can ship the frontend first and add the backend later.

Your site will be at **https://abhaykabdwal.github.io/SYSTEM.github.io/**

---

## Part 1 — Frontend on GitHub Pages

### 1. Switch Pages to GitHub Actions (do this before pushing)

GitHub → repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The old setup served `index.html` straight from the branch. That file now lives in `legacy/`, so if Pages is still on "Deploy from a branch" the site will show the README instead of the app.

### 2. Push

```bash
git push origin main
```

The **Test and deploy** workflow (`.github/workflows/deploy.yml`) runs lint, typecheck, tests and the build, then deploys `app/dist`. Watch it under the **Actions** tab. It takes about 2 minutes.

### 3. Check it

Open the site on your phone.

- **Existing v1 users:** the new app is on the same origin, so on first launch it copies the old `localStorage` data into the new storage automatically. The old data is left in place, untouched.
- **Installed v1 PWAs:** the new service worker has the same filename (`sw.js`), so the browser replaces the old, never-updating one. If a phone still shows the old app, close every SYSTEM tab or window and reopen it.
- **Install:** Android Chrome → menu → *Install app*. iPhone Safari → Share → *Add to Home Screen*.

Every later push to `main` redeploys. Pull requests run the checks without deploying.

---

## Part 2 — Backend on Supabase (accounts, encrypted sync, Hunters)

### 1. Create the project

1. Sign up at supabase.com → **New project**.
2. **Region:** pick the one closest to your users (Mumbai `ap-south-1` for India).
3. **Database password:** generate a strong one and store it in your password manager. You'll need it for `db push`.

> Free-tier projects **pause after 7 days without activity**. A paused project means sign-in and sync fail until you press *Restore* in the dashboard. Local data is unaffected. Upgrade, or keep it in use, if others depend on it.

### 2. Apply the database schema

You need Node 20+ locally for the Supabase CLI.

`supabase/config.toml` is already in the repo, with the live site's auth URLs, a 10-character minimum password and email confirmation on.

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

```bash
npx supabase db push --remote
```

```bash
npx supabase config push
```

The project ref (also called the project ID) is the `xxxx` in `https://xxxx.supabase.co`. Recent CLI versions target a local database unless you pass `--remote`. `config push` copies the auth settings from `config.toml` to the project. `db push` applies every file in `supabase/migrations/` in order:

- `20261102000000_init.sql`: profiles, encrypted vaults, follows, feats, likes, blocks, reports.
- `20261103000000_media_and_stats.sql`: the private `feat-media` storage bucket for Followers/Global photos (1 MB limit, JPEG/WebP only) and opt-in leaderboard stats.
- `20261104000000_private_media.sql`: the owner-only `vault-media` bucket for encrypted backups of Private photos.

**"Connection timed out" on `db push`?** Your network blocks the database ports (5432/6543), which is common on campus and office networks. The direct database address is also IPv6-only. Switch to a phone hotspot and rerun. `config push` and the website use HTTPS, so they aren't affected.

**No CLI?** Open the dashboard → **SQL Editor**, paste each migration file in order and run it once.

### 3. Test the security rules (recommended)

`supabase/tests/rls_test.sql` checks the rules that protect user data: vaults are private, followers-only feats stay hidden, blocks work, and anonymous visitors see nothing. Run them against your project. They run inside a transaction that is rolled back, so they leave nothing behind:

```bash
npx supabase test db --remote
```

All 25 checks should pass.

### 4. Configure auth

Dashboard → **Authentication**:

- **URL configuration, email confirmation, password length:** already set by `npx supabase config push`. Check under **URL Configuration** that the Site URL is `https://abhaykabdwal.github.io/SYSTEM.github.io/`.
- **Emails → SMTP Settings:** Supabase's built-in email sender is for testing only. It is heavily rate-limited and only delivers to your project team's addresses. Before inviting anyone else, connect a real SMTP provider (Resend, Brevo, Postmark, AWS SES…). Otherwise other people's sign-up and reset emails will never arrive.

### 5. Connect the frontend

Dashboard → **Project Settings → API**. Copy:

- **Project URL**
- **anon / public** key (or the newer *publishable* key)

Both are designed to be public: they ship to every browser, and the row-level security policies are what protect the data. **Never** use the `service_role` / *secret* key in the app or in GitHub.

GitHub → **Settings → Secrets and variables → Actions → Variables tab → New repository variable**:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the anon / publishable key |

Then **Actions → Test and deploy → Run workflow** (or push any commit). The rebuilt site shows Account & Sync and Hunters.

### 6. Try the whole flow

1. Phone: **More → Account & Sync → Sign up** → confirm the email → sign in.
2. **Create vault:** choose a passphrase and **save the recovery code**.
3. Log a quest.
4. Laptop: sign in → **Unlock** with the passphrase → the quest appears.
5. **Hunters → Share a feat**. From a second account, find the first one by handle → Follow → Like.

---

## Local development

```bash
cd app
```

```bash
npm install
```

```bash
npm run dev
```

To develop against Supabase, copy `app/.env.example` to `app/.env.local` and fill in the two values. `.env.local` is git-ignored.

**Node 18:** the app, tests and dev server work, but the production build's service-worker step needs Node 20+. Upgrade Node, or build with:

```bash
NODE_OPTIONS=--experimental-global-webcrypto npm run build
```

---

## Running it day to day

- **Reports:** dashboard → **Table Editor → reports**. To remove an abusive feat, delete its row in `feats`, then delete its photo (the `image_path` column) under **Storage → feat-media**. To ban someone, go to **Authentication → Users** and delete or ban the user; their data cascades away.
- **Backups:** synced vaults are end-to-end encrypted, so a database backup alone can't restore anyone's logs without their passphrase. Encourage users to keep their recovery code and use **Data Vault → Export** now and then.
- **Lost passphrase *and* recovery code:** nobody, including you, can decrypt that user's synced data. That's the privacy guarantee working as designed. Their local device copy is unaffected.
- **Schema changes:** add a new file in `supabase/migrations/`, then run `npx supabase db push`. Never edit a migration that has already been applied.
- **Custom domain (optional):** Settings → Pages → Custom domain. Then update the Supabase Site URL and Redirect URLs to the new domain. Users' local data is per-origin, so tell them to **Export** before you switch and **Import** after (or sign in to sync).

- **Storage use:** photos are compressed to ~100–250 KB each. The free tier includes 1 GB of storage, roughly 5,000 shared photos. Photos of deleted accounts stay in the bucket; clear `feat-media/<user id>/` by hand if you need the space.
- **Leaderboard honesty:** stats are reported by each player's app, so a determined user can fake them. Treat the leaderboard as a game, not a record.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Site shows the README | Pages source is still "Deploy from a branch". Switch it to GitHub Actions. |
| Workflow fails at "deploy" | Same cause, or the `github-pages` environment has branch protection that excludes `main`. |
| Account page says the build runs fully offline | The repo variables are missing or misspelled. The values are baked in at build time, so run the workflow again after adding them, then reopen the app. |
| Confirmation email never arrives | Custom SMTP isn't set up (see Part 2, step 4). |
| "redirect URL not allowed" after clicking an email link | Add the exact site URL, with the trailing slash, to Redirect URLs. |
| Sync says "Network error" | The Supabase project may be paused. Restore it in the dashboard. |
| Photo feats fail with "Bucket not found" | The second migration hasn't been applied. Run `npx supabase db push`. |
| "This device holds another account's data" | Someone else's data is on this browser. Export it if needed, then Data Vault → Erase device data before syncing a different account. |
