# SYSTEM

A Solo Leveling–inspired training tracker: daily random-gate quests, penalty and recovery quests, ranks and EXP, calisthenics skill trees, and a muscle fatigue map. Private by default and works offline.

**Hosting and backend setup:** see [docs/HOSTING.md](docs/HOSTING.md).

## Features

- **System calibration:** six questions (goals, equipment, push-up test, time, focus, joints to protect) build your quest pool from a 60-exercise library.
- **Rank-scaled quests:** each rank moves to harder variations (incline push-ups at E-rank, one-arm push-ups at S). Volume rises as you approach the next rank, and today's quest rotates away from yesterday's muscle groups.
- **Proof of workout:** attach a photo to verify the day. Choose Private (never leaves the device), Followers or Global. Without proof you keep half the quest EXP and the streak doesn't grow.
- **Streaks:** one rest day per Monday–Sunday week keeps the streak. Momentum (days without resting) adds up to +21% EXP on top of the streak bonus, so perfect 7/7 weeks pay the most. Flames, milestones and perfect-week bonuses.
- **Penalties:** a missed day costs EXP and breaks the streak. Clear the next day's penalty quest with proof to restore it. Penalties never cost a level.
- **Levels, ranks and trials:** level 1–100 from EXP. Reaching a rank's level unlocks its Rank-up Trial; clear it to be promoted.
- **Weekly instant dungeon:** an optional higher-volume boss run once a week.
- **Status window:** STR, AGI, VIT, SEN, INT and FATIGUE, derived from what you actually train.
- **Muscle map:** real anatomy art with a fatigue heat map. Load is counted in hard sets, estimated from your own recent bests (or an RPE you enter), and decays with each muscle's recovery half-life.
- **Hunters network (optional):** photo feats in three visibility modes, follows, likes, a weekly EXP leaderboard (opt-in), block and report.
- **Encrypted sync (optional):** logs are encrypted on the device (AES-256-GCM) with a key protected by your vault passphrase and a recovery code. The server stores only ciphertext.
- **Your data:** JSON export/import (v1 backups included), automatic migration from the v1 app, erase-device and delete-account controls.

The game rules live in `app/src/domain/ledger.ts` (EXP, streaks, penalties, ranks), `quests.ts` and `library.ts` (what you're asked to do) and `muscles.ts` (fatigue).

## Layout

| Path | What |
|---|---|
| `app/` | React + TypeScript PWA (Vite) |
| `app/src/domain/` | Pure game rules: exercise library, quests, ledger (EXP, streaks, penalties, ranks), muscles, skills, achievements |
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

## Credits

Anatomy art: OpenStax, *Anatomy and Physiology*, figure 11.5 ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), via the unlabeled versions on Wikimedia Commons. Labels and leader lines removed and the background made transparent for the muscle map.
