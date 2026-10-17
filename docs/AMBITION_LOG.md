# Ambition Log

Running log of the approved plan (`docs/AMBITION_PLAN.md`). Each entry: what changed, the
judge that verified it, before → after numbers.

## 2026-10-17 — Plan approved
Decisions: Render free (server DB disposable → device-as-backup in Bet 4), drop no-spread rule,
theme follows OS.

Baseline (from plan §1/§7): cold start → Focus ≈ 2.3–3.9 s (emulator, release); offline cold
start → Login; startup = 7 requests, p50 149 / p95 267 ms; 4/11 actions ≤ 2 taps; 3/~25 write
types offline; tests: mobile utils 7/17, backend services 0/14, routes 2/59, e2e 1/5;
WCAG pairs failing 69/160; Hermes 3.46 MB, assets 8.24 MB.

## 2026-10-17 — Slice 1: clean baseline (`aaf8999`, `3275a4e`)
- Dropped the no-spread lint rule; prettier normalised both packages (126 → 0 files failing
  `--check`); deleted `TimelineSummary.tsx`, `utils/formatting.ts`; LF via `.gitattributes`.
- `contracts/`: Outcome Score + streak spec, Python reference oracle, 14 shared vectors.
- Judges: tsc/eslint/prettier/vitest green in both packages.

## 2026-10-17 — Bets 10 + 11: accessibility & performance (merge of agent branch, details `docs/log/mobile-a11y-perf.md`)
| Metric | Before | After | Judge |
|---|---|---|---|
| Failing WCAG pairs (210 checked, both palettes) | 75 | 0 | contrast unit test |
| Touchables without role / unlabeled glyph controls / control types < 44 pt | 38 / 2 / 9 | 0 / 0 / 0 | static AST test |
| Hermes bundle | 3,461,852 B | 3,157,936 B (after logic merge) | `npm run perf:bundle` |
| Assets | 8.24 MB, 77 files, 53 fonts | 0.88 MB, 29 files, 5 fonts | same |
| Screens re-rendered per toast | 5+5 | 0+0 | render-count harness |
Theme follows OS (`userInterfaceStyle: automatic`); screenshots in `docs/log/screens/a11y/`.
Verified on main after merge: tsc, eslint, prettier, 58 tests, bundle budget PASS.

## 2026-10-17 — Bet 3: security (details `docs/log/backend-security.md`)
| Metric | Before | After | Judge |
|---|---|---|---|
| Rotated refresh token reusable | yes (bcrypt 72-byte prefix) | no; reuse revokes family | API tests |
| IDOR matrix failures | 7 / 20 | 0 / 20 | `idor.api.test.ts` |
| Routes with 2xx + 4xx API test | 1 / 59 | 59 / 59 | coverage check (fails the run if any missing) |
| Mutating routes without Zod | several | 0 | `routeCoverage.test.ts` walks `app._router` |
| `npm audit --omit=dev` (backend) | 5 | 0 | npm audit |
| `/auth/refresh` median | ~135 ms | 5.3 ms | API timing |
Verified on main after merge: tsc, eslint, prettier, 29 unit + 117 API tests PASS.

## 2026-10-17 — Bets 5, 6, 7: outcome score, training, nutrition (details `docs/log/mobile-logic.md`)
- Outcome score matches 14/14 contract vectors; streak with ISO-week grace, "pending" state,
  no 30-day cap. Focus ring shows "Day" (outcome) + "Routine %".
- Training: stall → 90% deload, all-time-best PRs (one per lift/session), Epley capped ≤ 10
  reps, equipment-aware loading, alias table (35/42 unmatched program names → 0), rest days and
  day advance, ≥ 80% sets = done; seed programs ≥ 10 sets/muscle/week.
- Nutrition: Mifflin-St Jeor × activity × goal (needs height/sex in schema — falls back to
  33 kcal/kg × goal until then), protein floor 1.6 g/kg, Apply overrides, trend weight,
  adaptive TDEE; barcode serving size, kJ, 6 s timeout, offline vs not-found.
- Workout timer split: consumer renders during 10 s of a workout 20 → 0.
- Utils with tests 7/17 → 24/24. Mobile tests 48 → 269.
Verified on main after merge (2 context conflicts resolved): tsc, eslint, prettier, 269
tests, bundle budget PASS.

## 2026-10-17 — Bets 1/2/4/5 server side (details `docs/log/backend-sync.md`, client contract `docs/log/backend-sync-api.md`)
| Metric | Before | After | Judge |
|---|---|---|---|
| Migrations reproduce schema | no (drift) | yes, empty diff | `npm run db:check-migrations` |
| Render deploy | `prisma db push` at boot | `scripts/migrate-deploy.sh` (baselines db-push DBs) | `db:verify-deploy` 13/13 |
| "Today" data | 7 requests, p95 173–267 ms | `GET /api/today` 1 request, p50 15.8 / p95 22.6 ms, 22 KB (3.6 KB gz) | `npm run perf:today` (200 runs, 1 seeded year) |
| Duplicate creates on retry | yes | no (client UUIDs, upsert) | API regression tests |
| Two-device convergence | stale toggles / LWW zeros / field wipes reproduced | 200/200 property runs converge (2,665 requests, 1,352 dups, skew ±10 min) | fast-check test |
| Score | client-posted, last writer wins | server-computed per contract; client POST only triggers recompute | API test |
| Backup | export missed 5 tables | export/import v2, 15 tables, round-trip identical | round-trip test |
| API tests | 117 | 171 (61/61 routes 2xx+4xx) | `npm run test:api` |
Verified on main after merge.
Open: no tombstones (client outbox must cancel create+delete), no delta sync.

## 2026-10-17 — Bet 14 machinery (details `docs/log/machinery.md`)
- `npm run check` in backend/ (tsc, eslint, prettier, unit, API, migration drift) and mobile/
  (tsc, eslint, prettier, unit, app.config, bundle budget, e2e smoke). Local DB URLs in a
  gitignored `.env.check.local`. Verified on main: both CHECK PASSED.
- Playwright self-contained (starts API from migrations + Expo web); fixed Monday-09:00 clock.
- Tap/time harness, baseline (current UI): pass ≤2 taps — log set, planned meal, one
  supplement, check-in, what's-next; fail — finish workout 15 taps, all AM supplements 3,
  bodyweight/sleep 3 taps + 1 input via 2 screens, ad-hoc food blocked by crash (B2), schedule
  tick blocked (B3: UI never updates).
- `mobile/app.config.ts`: cleartext only for local API builds (5 config cases tested).
- `.github/workflows/ci.yml`: backend (Postgres service), migration drift, mobile, e2e jobs.
  Not yet run on GitHub — push is blocked in this session.
- Android scripts: `scripts/android/` build + cold-start (p50/p90). Loaded host run: first frame
  p50 796 ms, "Day score" p50 6.5 s — re-measure idle.
- Bugs found by the harness: B1 web logout after login (refresh via cookie only), B2 Nutrition
  crash after food add, B3 schedule tick not re-rendered (in-place cache mutation). Routed to
  client-data (B1, B3) and nav (B2) agents.
