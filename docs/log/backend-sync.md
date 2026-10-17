# Log — backend sync (server side of Bets 1, 2, 4, 5, 13)

Date: 2026-10-17. Branch `worktree-agent-adcbfed0c9e01848a` (fast-forwarded to `3275a4e`,
then merged `main` @ `4850362` with backend-security). Client contract:
[`backend-sync-api.md`](backend-sync-api.md).

## Commits
1. `b2f8b57` feat(db): migrations reproduce schema.prisma; migrate-deploy for Render
2. `528f218` feat(score): pure Outcome Score, streak, HLC and date helpers
3. `5d03b9f` feat(sync): idempotent creates, HLC LWW writes, server score, /today, backup v2
4. `02b3286` Merge main (backend security) + RefreshToken / User.heightCm,sex migrations
5. docs commit (this log + API contract)

## Bet 4 — migrations
- Before: migrations missed `User.age/username/weight`, `MealTemplate.foodId/grams`,
  `MealTemplateTag` index (reproduced: `migrate diff` printed exactly those).
- New migrations: `20261017000000_baseline_drift_fix`, `20261017010000_sync_hlc_outcome_score`
  (dedupes duplicate workout sets before the unique index), `20261017020000_refresh_token_family`
  (security branch's schema change had no migration; deletes legacy bcrypt rows that can never
  match a sha256 lookup), `20261017030000_user_height_sex`.
- `npm run db:check-migrations`: resets `onyx_mig_check`, `migrate deploy`, `migrate diff
  --exit-code` → **OK, empty diff**.
- `scripts/migrate-deploy.sh` (render.yaml `startCommand: bash scripts/migrate-deploy.sh && npm start`):
  state `pushed` (tables, no `_prisma_migrations`) → `db push` of `prisma/baseline/schema.baseline.prisma`
  (no `--accept-data-loss`) → `migrate resolve --applied` the 6 baseline migrations → `migrate deploy`.
- `npm run db:verify-deploy`: 13/13 checks — empty DB; DB `db push`ed from the 2026-06-13 schema
  (`9a2801b`) with data incl. duplicate sets → data kept, duplicate removed, users get an epoch,
  diff empty; redeploy no-op; DB pushed at exactly the baseline → diff empty.
- API tests now build their DB with `prisma migrate reset` (not `db push`).

## Bet 2 — idempotency + HLC
- Client UUID on every create (blocks, supplements, meal templates, programs/days/exercises,
  sessions, sets, daily logs, user foods, toggles). Replay → same row, 201→200; foreign id → 409.
- Toggles and sets: one atomic `INSERT … ON CONFLICT … DO UPDATE … WHERE hlc newer`
  (`COLLATE "C"`), ownership via `WHERE EXISTS` → 404 for missing / foreign targets.
- DailyLog: field-level (POST and new `PATCH /logs/:date`), per-field `fieldClock`, row lock.
- `seed-starter`: advisory xact lock + in-transaction emptiness check.
- v1 import keeps ids; v1 export adds meal `grams/foodId`.

## Bet 5 — score
- `computeOutcomeScore` matches all 14 vectors of `contracts/score-vectors.json`; streak per
  contracts/README (unscored days break, not graceable — same as mobile-logic).
- DailyScore rows recomputed on every relevant write and on `/today`; legacy rows (computedAt
  null) recomputed lazily on `GET /scores`. `POST /scores` validates but ignores client values
  → the audit 02 finding-4 clobber is impossible (test R6 + `score-today` + `scores.api`).
  **This also covers mobile-logic's routine % POST: it cannot overwrite server fields.**
- Plan rule documented in the API contract §4 (weekdays → DailyLog.day → session → rest).

## Bet 1 — `/today`
`npm run perf:today` (seed 1 year: 2041 completions, 1138 supp logs, 1246 meal logs, 365 daily
logs, 173 sessions, 2595 sets; 20 warm-ups; 200 sequential requests in-process, local PG 18):

| run | p50 | p95 | p99 | max | payload | gzip |
|---|---|---|---|---|---|---|
| final (merged) | **16.8 ms** | **23.8 ms** | 27.4 | 29.4 | 22.1 KB | 3.5 KB |
| reads via `$transaction([...])` (rejected) | 26.9 | 34.4 | | | | |

Legacy `/sync/export` for the same user: 269 KB. Budget p95 < 150 ms: met. Reads run with
`Promise.all` (the array `$transaction` executes sequentially; measured above).

## Bet 4/13 — backup v2 + epoch
- Round trip (1 seeded year): export → wipe → import (**1.3 s**) → export: deep-equal on all
  15 tables + prefs + user. Re-import: 0 created / 0 updated. Older backup does not overwrite a
  newer server toggle. Recreated-server path: account deleted → re-register → epoch differs →
  import → identical tables, selected program restored, `/today` counts 365 scores.
- `401 ACCOUNT_NOT_FOUND` from `/today` for a token whose account is gone.

## Convergence (fast-check, `test/convergence.api.test.ts`)
200 runs, 2665 requests, 1352 duplicate deliveries, 639 drop+retry, 843 concurrent batches;
ops: toggles (6 targets × 2 days), daily-log fields, sets, idempotent creates; per-device skew
±10 min. Server state == max-HLC reference model in **200/200** runs.

## Regressions (`test/regressions-audit02.api.test.ts`, 13 tests)
§2.1 dup creates/sets · §2.2 lost-response retry · §2.3 on/off race ×30 · §2.4 stale queue replay ·
§2.5 impossible dates (4 routes) · §2.5 tz "today" · §2.6 score clobber · §2.7 log field clobber ·
§2.8 toggle on deleted target → 404 · §2.9 import keeps ids · §2.11 cross-user toggles · seed race ×5 ·
§3.7 export grams. §2.10 (refresh tokens) belongs to backend-security.

## Judges (merged result)
`tsc` 0 · `eslint src` 0 · `prettier --check src test` clean · `vitest run` 81/81 ·
`test:api` 171/171 three times (186 s, 101 s, 102 s), route coverage 61/61 ·
`db:check-migrations` OK · `db:verify-deploy` 13/13.

## Notes / not done
- Merge conflicts were resolved toward main's validators + my additions; `PATCH /logs/:date`
  is IDOR-exempt (date-keyed, own row only). `isoDate` now bounds years to 2000–2100.
- Found, not fixed: `PATCH /meals/templates/:id/grams` writes absolute macros into tags while the
  app (and now the server score) scale tags by grams/100 → double scaling for that path.
- No delete tombstones (client outbox must coalesce); no delta sync endpoint; `GymProgram.userId`
  has no FK (orphans on account delete).
- Weekly encrypted backup job and the client outbox/rehydrate are out of scope (client team).
