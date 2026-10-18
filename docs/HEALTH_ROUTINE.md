# Onyx Health Routine

A weekly checklist a future agent can run alone, without the owner. Every step names the
command (the judge) and what "healthy" means. Record each run as a dated entry at the bottom
of `docs/AMBITION_LOG.md` (numbers, not adjectives). If a step fails, fix it in a small
commit before doing anything else.

Never point anything at production (`onyx-api-wmis.onrender.com`) except the read-only health
probe in step 8. Never write to databases other than local `*_test`, `onyx_dev`, `onyx_mig_check`.

## 0. Prerequisites (once per machine)
- Node 24, npm 11; local PostgreSQL (Windows service `postgresql-x64-18`).
- Repo-root `.env.check.local` (gitignored):
  ```
  TEST_DATABASE_URL=postgresql://<user>:<pw>@localhost:5432/onyx_test
  E2E_DATABASE_URL=postgresql://<user>:<pw>@localhost:5432/onyx_e2e_test
  ```
  Create the DBs with `psql -c "create database onyx_test;"` etc. Names must end in `_test`
  (the harness refuses anything else and refuses non-local hosts).
- `npm install` in `backend/`, `mobile/`, `e2e/`; `npx playwright install chromium` in `e2e/`.
- Android (optional, for step 6): JDK 17, Android SDK 36/NDK 27.1, AVD `onyx_pixel`, Maestro.
  See `docs/log/machinery.md` and `scripts/android/`.

## 1. Full judges — must be green
```bash
cd backend && npm run check     # tsc, eslint, prettier, unit, API (all routes 2xx+4xx), migration drift
cd mobile && npm run check      # tsc, eslint, prettier, unit (contrast, touchables, score vectors), config, bundle budget, e2e smoke
cd e2e && E2E_ENFORCE_BUDGETS=1 npx playwright test   # core flows ≤2 taps/≤5 s, offline, first viewport
```
Healthy: `CHECK PASSED` twice; Playwright 0 failed (expected-fail tests must still be
expected — if one starts *passing*, the bug was fixed: convert it to a normal test).

## 2. CI
`gh run list --limit 5` — latest run on `main` green. If red, read the failing job log first.

## 3. Performance budgets
```bash
cd backend && npm run perf:today     # GET /api/today on 1 seeded year: p95 must stay < 150 ms (baseline 22.6 ms)
cd mobile && npm run perf:bundle     # Hermes / assets / fonts budgets (fails loudly on regression)
```
Record p50/p95 and bundle bytes in the log. A >20% regression without a reason is a bug.

## 4. Dependencies & security
```bash
cd backend && npm audit --omit=dev   # target: 0 high/critical
cd mobile && npx expo install --check   # Expo-compatible versions
cd mobile && npm audit --omit=dev
```
Patch/minor updates: apply, run step 1, commit. Major updates: one package per commit, with
its changelog read and step 1 + step 6 green.

## 5. Data safety drill (monthly)
- Backup round-trip is a test (`backend/test/backup.api.test.ts`), so step 1 covers correctness.
- Drill: on `onyx_dev`, export v2 for the test user → wipe that user's rows → import v2 →
  compare counts. The client re-hydrates an empty server automatically (dataEpoch protocol,
  `docs/log/backend-sync-api.md` §5) — the production DB is on Render free and can vanish.

## 6. Device check (monthly, or after native/dependency changes)
- `scripts/android/` build-release (short path — Windows 260-char limit) → install on `onyx_pixel`.
- Maestro: `e2e/maestro/login.yaml`, `coldstart-focus.yaml`; `npm run perf:tti` (needs
  `ONYX_PERF` marks in logcat). Record cold start → interactive Today p50/p90. Target < 1.0 s.
- Airplane mode → kill → relaunch: Today must show cached data (not Login).

## 7. Outcome review (monthly, needs owner's data access)
- Re-run the missed-session predictor on real data: `docs/audit/04-score-and-prediction.md`
  §B6 (`docs/audit/scripts/analyze.py`). Only enable the early-warning nudge
  (`FEATURE_FLAGS`) if held-out AUC beats the day-of-week baseline by ≥ 0.05.
- Look at 4-week trends from `/api/scores`: sessions done vs planned, protein-days ≥ 5/7.

## 8. Production probe (read-only)
`curl -s -m 90 https://onyx-api-wmis.onrender.com/api/health` — note the status and time.
Free tier sleeps; > 60 s or no answer twice → owner must check the Render dashboard (DB
expiry). Don't try to fix production from here.

## 9. Docs
- `AGENTS.md` still matches reality? The `docs` judge (`npm run check:docs`, part of
  `npm run check`) catches stale paths and script names; spot-check 5 other claims against
  the code; fix drift.
- New audit findings go to `docs/audit/`, plans to `docs/AMBITION_PLAN.md`, results to
  `docs/AMBITION_LOG.md`.
