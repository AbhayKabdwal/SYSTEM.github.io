# SYSTEM

A Solo Leveling–inspired training tracker: daily random-gate quests, penalty and recovery quests, ranks and EXP, calisthenics skill trees, and a muscle fatigue map. Private by default and works offline.

**Hosting and backend setup:** see [docs/HOSTING.md](docs/HOSTING.md).

## Features

- **Quests:** a fixed random gate per date from your quest pool. Missing a day triggers a penalty quest; falling behind triggers a recovery protocol.
- **EXP and ranks:** EXP for cleared quests, penalty clears, logged sets and streaks, climbing from E-rank to the top of the ladder.
- **Muscle map:** front and back body map of 16 muscle groups. Load from every set and quest task decays with each muscle's recovery half-life.
- **Training registry:** your own training types and exercises, each mapped to muscles (auto-detected or set by hand), plus an editable quest pool.
- **Skill trees:** planche, front lever, muscle-up, HSPU, pistol and L-sit progressions, unlocked by logged holds and reps.
- **Archives:** every day with sets, EXP breakdown, muscles worked and progress photos.
- **Hunters network (optional):** share feats, follow, like, block and report. Posting is opt-in, and each feat is visible to followers only or to everyone.
- **Encrypted sync (optional):** logs are encrypted on the device (AES-256-GCM) with a key protected by your vault passphrase and a recovery code. The server stores only ciphertext.
- **Your data:** JSON export/import (v1 backups included), automatic migration from the v1 app, erase-device and delete-account controls. Photos never leave the device.

## Layout

| Path | What |
|---|---|
| `app/` | React + TypeScript PWA (Vite) |
| `app/src/domain/` | Pure game rules: quests, streaks, EXP, ranks, muscles, skills, achievements |
| `app/src/data/` | IndexedDB storage, backups, encryption, v1 migration |
| `app/src/cloud/` | Supabase client: auth, encrypted vault sync, social |
| `app/src/state/` | App and session stores (zustand) |
| `app/src/features/` | One folder per screen |
| `app/src/ui/` | Shared components, theme, hooks |
| `supabase/migrations/` | Database schema with row-level security |
| `supabase/tests/` | pgTAP tests for the security policies |
| `legacy/` | The original single-file v1 app, kept for reference |

The rules for `domain/`: no React, no DOM, no storage, and no reading the clock (only `todayStr()` does). Pass `today` in. ESLint enforces this, and bans `dangerouslySetInnerHTML` everywhere.

## Develop

Requires Node 20+.

```bash
cd app
```

```bash
npm install
```

```bash
npm run dev
```

The full check, the same as CI:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Tests run in `Asia/Kolkata` so timezone bugs surface.
