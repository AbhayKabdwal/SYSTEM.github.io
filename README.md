# SYSTEM

A Solo Leveling–style fitness tracker: daily quests, penalty and recovery quests, ranks, and calisthenics skill trees.

## Layout

| Path | What |
|---|---|
| `index.html`, `sw.js`, `manifest.json` | v1 single-file app, still what GitHub Pages serves |
| `app/` | React + TypeScript rebuild (in progress) |

## The rebuild (`app/`)

```
src/
  domain/    pure game rules (rank, quests, streak, penalty, fatigue, skills) + tests
  data/      storage adapters (currently a read-only view of v1 localStorage)
  features/  screens, one folder per tab
  ui/        shared components and theme
```

Rules for `domain/`: no React, no DOM, no storage, no reading the clock (only `todayStr()` does) — pass `today` in.
ESLint enforces this, and bans `dangerouslySetInnerHTML` everywhere.

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm test           # vitest, runs in Asia/Kolkata so date bugs show up
npm run lint && npm run typecheck && npm run build
```

### Roadmap

0. **Foundation:** scaffold, domain logic ported with tests, date/rank/quest-seed fixes ← done
1. **Parity:** all six tabs in React, IndexedDB, v1 backup import, self-hosted fonts, versioned service worker, Pages deploy
2. **Real EXP + per-muscle fatigue map**
3. **Accounts + end-to-end encrypted sync**
4. **Social:** feats, follow, likes, block/report
