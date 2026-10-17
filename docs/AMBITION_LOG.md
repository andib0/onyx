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
