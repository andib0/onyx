# Onyx

A personal daily operating system for training, nutrition and routine. Open it and within
ten seconds you know what to do today; logging a set, a meal or a supplement takes a tap or two.

**Live web build:** https://onyx-bay-theta.vercel.app

## What it does

- **Today** — one screen with the day's training, meals, supplements and an Outcome Score
- **Train** — programs, workout logging with resume after app kill, PRs, stall/deload detection
- **Eat** — goal-aware calorie and protein targets, adaptive TDEE, barcode scanning, quick-log
- **Progress** — streaks with weekly grace days, insights and achievements
- **Local-first** — works fully offline; writes go through a durable outbox and sync with
  hybrid logical clocks, and the server can be rebuilt from the device if its database is wiped

## Stack

| | |
|---|---|
| `mobile/` | Expo 54, React Native 0.81, React 19, Expo Router, TanStack Query (persisted) |
| `backend/` | Node, Express, Prisma, PostgreSQL, Zod, JWT auth |
| `e2e/` | Playwright against the Expo web build, Maestro flows for Android |

## Getting started

Each folder is its own package; there is no root `package.json`.

```bash
# backend
cd backend
cp .env.example .env      # set DATABASE_URL and JWT secrets
npm install
npm run db:migrate
npm run dev

# mobile (in another terminal)
cd mobile
npm install
npx expo start
```

## Checks

```bash
cd backend && npm run check   # types, lint, format, unit + API tests, migrations
cd mobile && npm run check    # types, lint, format, unit tests, bundle budget, e2e smoke
```

CI runs the same checks on every push (`.github/workflows/ci.yml`).

More detail on architecture, data model and conventions lives in [AGENTS.md](AGENTS.md) and `docs/`.
