# AGENTS.md

Single source of truth for agents maintaining **Onyx**. Every path and `npm run` name
below is checked by `scripts/check-agents-md.mjs` (judge `docs` in `npm run check`), so
if you move a file or rename a script, update this doc in the same commit.

## 1. Project overview

Onyx is a personal daily operating system for training, nutrition and routine: an
**Expo / React Native app** (`mobile/`) backed by a small **Express + Prisma + PostgreSQL**
REST API (`backend/`) with JWT auth. Single user, single owner.

**The outcome it optimises** (from `docs/AMBITION_PLAN.md`): open Onyx → within 10 s know
what to do today; logging is near-zero effort (core actions ≤ 2 taps, ≤ 5 s); never loses
data, works offline, never crashes; measurably more consistent training and closer-to-target
eating; stays healthy without the owner (judges + `docs/HEALTH_ROUTINE.md`).

Architecture in one paragraph: the app is **local-first**. It renders Today from a
persisted query cache with zero network requests, revalidates with one `GET /api/today`,
and sends every write through a durable per-user **outbox** (client UUIDs, hybrid logical
clocks). The server is idempotent, merges by HLC, computes the **Outcome Score**, and can be
**rehydrated** from the device if its (free, disposable) database is wiped.

## 2. Stack (versions from each `package.json`)

| Area | Mobile (`mobile/package.json`) | Backend (`backend/package.json`) |
|---|---|---|
| Runtime | Expo ~54.0.33, React Native 0.81.5, React 19.1.0 | Node (CI: 22), Express ^4.21 (lock 4.22.x), ESM, run with tsx ^4.19 |
| Routing / data | Expo Router ~6.0.23; TanStack Query ^5.101.2 + `@tanstack/react-query-persist-client` | Prisma ^5.22 + PostgreSQL; Zod ^3.23 |
| Native modules | reanimated ~4.1.1, gesture-handler ~2.28, svg 15.12.1, expo-camera (barcode), expo-notifications, expo-secure-store, expo-file-system, expo-splash-screen, expo-sharing, expo-haptics, AsyncStorage 2.2.0 | helmet ^8, cors, cookie-parser, express-rate-limit ^7.4, jsonwebtoken ^9, bcryptjs (passwords) |
| Language | TypeScript ~5.9.2 (strict) | TypeScript ^5.6.3 |
| Tests | Vitest ^4.1.9, fast-check ^4, react-test-renderer | Vitest ^4.1.9, supertest, fast-check ^3 |
| E2E (`e2e/package.json`) | Playwright 1.55.1 (Expo web build), Maestro flows for Android | |

Fonts: Archivo 700/800 + JetBrains Mono 500/700, imported by weight subpath in
`mobile/app/_layout.tsx`. `tsx` is a runtime **dependency** of the backend (seed + perf scripts).

## 3. Repo structure

Independent packages, no root `package.json`; run tooling inside each package.

- `mobile/` — the app.
  - `mobile/app/` — Expo Router routes. Tabs (`mobile/app/(tabs)/_layout.tsx`): **Today · Train · Eat · Progress**
    (`today.tsx`, `train.tsx`, `eat.tsx`, `progress.tsx`); `mobile/app/(tabs)/focus.tsx` is a hidden
    redirect to Today for old deep links. Stack screens: `settings.tsx` (gear on Today),
    `schedule.tsx`, `training-plan.tsx`, `supplements.tsx`, `log.tsx` (history), `program-editor.tsx`,
    `insights.tsx`, `achievements.tsx`, `onboarding.tsx`, `exercise/[name].tsx`, `(auth)/login.tsx`,
    `(auth)/register.tsx`, `index.tsx`, `+not-found.tsx`.
  - `mobile/sync/` — local-first data layer (see §5): `outbox.ts`, `intents.ts`, `applyDay.ts`,
    `runtime.ts`, `writes.ts`, `dayData.ts`, `persist.ts`, `blobStore.ts`, `queryKeys.ts`,
    `connectivity.ts`, `hlc.ts`, `uuid.ts`, `serverData.ts`, `webShell.ts`.
  - `mobile/api/` — typed fetch wrappers per resource; `mobile/api/client.ts` (timeout, lazy refresh),
    `mobile/api/session.ts` (offline session restore), `tokenStore.ts` / `tokenStore.web.ts`.
  - `mobile/contexts/` — Auth, Theme, AppState (composer), Toast, Program, Data, Schedule,
    Meals, Supplements, Timeline.
  - `mobile/hooks/` — domain hooks (`useWorkout.ts`, `useProgram.ts`, `useCompletion.ts`,
    `useLog.ts`, `useSyncStatus.ts`, `useStableHandlers.ts`, …); `mobile/hooks/ui/` — Today/quick-log
    adapters (`useTodayPlan.ts`, `useTodayMeals.ts`, `quickLog.tsx`, `undo.tsx`, `useTrainingIntention.ts`).
  - `mobile/components/` — `ui/` primitives (Button, Card, Sheet, Stepper, Ring, FAB, …), `today/`,
    `quicklog/`, `train/`, `focus/` (workout views + cards reused by Today), `nutrition/`, `schedule/`,
    `supplements/`, `onboarding/`, `log/`, `shared/`, `layout/`, plus `ReminderSync.tsx` and
    `NotificationResponder.tsx`.
  - `mobile/utils/` — pure logic, all unit-tested: `outcomeScore.ts`, `dayPlan.ts`, `reminderPlan.ts`,
    `progression.ts`, `e1rm.ts`, `plates.ts`, `exerciseNames.ts`, `nutrition.ts`, `adaptiveTargets.ts`,
    `openFoodFacts.ts`, `trainingIntention.ts`, `notifications.ts`, `perfMarks.ts`, …
  - `mobile/theme.ts` (tokens), `mobile/theme/contrast.ts`, `mobile/theme/sharedStyles.ts`,
    `mobile/data/exerciseCatalog.ts`, `mobile/types/`, `mobile/public/sw.js` (web-only offline shell).
  - `mobile/scripts/` — `check-bundle-budget.mjs`, `measure-tti.sh`, `analyze-sourcemap.mjs`.
  - `mobile/app.json` + `mobile/app.config.ts` (cleartext only for local http APIs).
- `backend/` — the API.
  - `backend/src/app.ts` (middleware), `backend/src/server.ts`, `backend/src/config/env.ts`,
    `backend/src/config/database.ts`.
  - `backend/src/routes/` → `backend/src/controllers/` → `backend/src/services/`, Zod schemas in
    `backend/src/validators/`, middleware in `backend/src/middleware/` (`auth.ts`, `validate.ts`,
    `rateLimit.ts`, `errorHandler.ts`).
  - `backend/src/services/score/` (Outcome Score, streak, day facts), `backend/src/services/sync/`
    (backup v2, HLC toggles), `backend/src/services/today.service.ts`,
    `backend/src/services/sessionRevocation.ts`.
  - `backend/src/utils/` — `hlc.ts`, `idempotent.ts`, `dates.ts`, `jwt.ts`, `password.ts`, `errors.ts`, `response.ts`.
  - `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `backend/prisma/baseline/schema.baseline.prisma`,
    `backend/prisma/seed/` (exercises, foods, programs, supplements).
  - `backend/scripts/` — `migrate-deploy.sh`, `db-state.mjs`, `check-migrations.mjs`,
    `verify-migrate-deploy.mjs`, `backend/scripts/perf/` (`today.bench.ts`, `bench.mjs`, `seed_bench.mjs`).
  - `backend/test/` — API tests (`*.api.test.ts`), `globalSetup.ts` (DB guard), `routeTable.ts`,
    `apiCoverage.ts`, `routeCoverage.test.ts`; unit tests sit next to the code (`*.test.ts` in `src/`).
  - `backend/render.yaml`, `backend/.env.example`.
- `e2e/` — Playwright (`e2e/playwright.config.ts`, `e2e/tests/`, `e2e/lib/flow.ts` tap/time
  instrument, `e2e/scripts/start-api.mjs`, `e2e/scripts/env.mjs`) and Maestro flows (`e2e/maestro/`).
- `contracts/` — shared specs with a reference oracle: `contracts/README.md`,
  `contracts/outcome_score_reference.py`, `contracts/score-vectors.json`.
- `scripts/` — `scripts/check.mjs` (judge runner), `scripts/check-agents-md.mjs` (this doc's judge),
  `scripts/test-app-config.mjs`, `scripts/android/` (`build-release.ps1`, `coldstart.ps1`).
- `docs/` — see §11. `.github/workflows/ci.yml` — CI.

## 4. Data architecture (backend)

PostgreSQL via Prisma is the server of record; the device holds a full copy (§5).
`backend/prisma/schema.prisma` has **21 models**:

- Auth/user: `User` (+ `username`, `age`, `weight`, `heightCm`, `sex`, `dataEpoch`), `UserPreferences`
  (timezone, selected program/day, numeric `proteinTargetG` / `calorieTargetKcal` /
  `goalRateKgPerWeek`), `RefreshToken` (`tokenHash` sha256 unique, `familyId`).
- Schedule: `ScheduleBlock`, `Completion`. Supplements: `Supplement` (single `timeAt` "HH:MM"),
  `SupplementLog`, reference `SupplementDatabase`.
- Meals: `MealTemplate` (+ `grams`, `foodId`; `dayOfWeek` is a weekday **or an ISO date** for
  one-off foods), `MealTemplateTag` (macros per 100 g), `MealLog`, reference `Food`, `UserFood`.
- `DailyLog` (bw, sleep, steps, top sets, notes) with per-field `fieldClock` JSON.
- Workouts: `WorkoutSession` (+ `markedDone`), `WorkoutSetLog` (unique per session + exercise + set number),
  reference `ExerciseLibrary`. Programs: `GymProgram` (system + user, FK to user),
  `ProgramDay` (`weekdays Int[]`, ISO 1 = Mon), `ProgramExercise`.
- `DailyScore` — **server-computed** Outcome Score per day (`outcomeScore` null = unscored,
  `kept`, components, `routinePct`; legacy `score` = routine %).
- `Tombstone` — deleted ids (`entity`, `entityId`, `hlc`), unique per user + entity + id.
- `ScheduleBlock`, `Supplement`, `MealTemplate`, `GymProgram` carry a per-field `fieldClock` JSON.

Sync primitives:
- **Client ids**: every create accepts an optional UUID `id`; a replay returns the same row
  (201 then 200); an id owned by another account → 409. There is no `Idempotency-Key` header —
  idempotency is the client id.
- **HLC** `<13-digit ms>-<4-digit counter>-<deviceId>` (`backend/src/utils/hlc.ts`, mirror in
  `mobile/sync/hlc.ts`), compared as strings. Toggles (`Completion`, `SupplementLog`, `MealLog`)
  and sets carry `hlc`; last-writer-wins by HLC, not arrival. Stamps > 24 h ahead → 400.
  Daily logs merge per field (`PATCH /api/logs/:date`). Entity edits (PUT on blocks,
  supplements, meal templates, programs) are **per-field HLC last-writer-wins** via
  `fieldClock` (creates stamp every field they set; a PUT without `hlc` always applies;
  `backend/src/services/sync/fieldClock.ts`). The outbox keeps one stamp per field when it
  coalesces edits and sends one PUT per stamp. Toggle rows without a client id get an id
  derived from their natural key; toggle/set timestamps come from the HLC.
- **Tombstones** (`backend/src/services/sync/tombstones.ts`): deleting a block, supplement,
  meal template, program (+ days, exercises), session (+ sets), set or saved food records
  `(entity, id, hlc)`; DELETE bodies may carry `{hlc}`. Delete wins: any later create, edit,
  toggle, set or finish naming that id answers **410** and changes nothing; the outbox drops
  ops on 410. Export v2 carries `tombstones`; import v2 applies them first. Daily logs are not
  tombstoned (date-keyed, field-LWW). A never-sent create + delete pair still cancels locally.
- **Mark done** (`PATCH /api/workouts/sessions/:id/finish {markedDone:true}`, or a finished
  session with no sets): T = 1 on a train day — contract input `markedDone`.
- **Outcome Score** (spec `contracts/README.md`): 0.40 training vs plan + 0.30 protein +
  0.20 calories + 0.10 bodyweight trend; kept day = training done AND protein ≥ 85 %;
  streak with one grace day per ISO week. Recomputed on every relevant write and on
  `/today`; `POST /api/scores` only triggers a recompute (client values ignored). Both packages
  test against `contracts/score-vectors.json` — change the Python reference first.
- **dataEpoch**: random per account (DB default), returned by `/today` and export v2. A changed
  epoch or `401 ACCOUNT_NOT_FOUND` means the server lost data → the app rehydrates it (§5).
- Dates are `"YYYY-MM-DD"` strings (validated real dates, years 2000–2100); per-day rows use
  `@@unique([userId|parentId, …, date])`. Server "today" uses `UserPreferences.timezone`.

Migrations reproduce the schema exactly (`npm run db:check-migrations` asserts an empty diff).
Never use `db push` against a real database; add a migration with `npm run db:migrate`.

## 5. Client state (mobile)

Provider tree (`mobile/app/_layout.tsx`): `GestureHandlerRootView → SafeAreaProvider →
PersistQueryClientProvider → ThemeProvider → AuthProvider → AppStateProvider → ErrorBoundary →
Stack`. `AppStateProvider` (`mobile/contexts/AppStateContext.tsx`) nests `Toast → Program →
Data → Schedule → Meals → Supplements → Timeline`. There is no `useAppState()` shim any more —
use the domain hooks. Provider values are memoised; mutators go through `useStableHandlers`.

- **Persisted query cache** (`mobile/sync/persist.ts`): buster `onyx-cache-v1`, max age 60 days,
  500 ms throttle, flushed on background. Stored as blob `onyx-query-cache` — a file on native
  (`mobile/sync/blobStore.ts`; AsyncStorage rows > 2 MB fail on Android), AsyncStorage on web.
  Persisted roots (`mobile/sync/queryKeys.ts`): `today`, `appState`, `programs`, `program`,
  `userFoods`, `workoutHistory`, all keyed by user id. The splash stays up until fonts, session
  and cache are ready.
- **Today**: query `["today", userId, localDate]` → `GET /api/today`, merged into
  `["appState", userId]` with pending outbox ops re-applied. History (`/sync/export?v=2`) is
  refreshed in the background at most daily.
- **Session restore without network** (`mobile/api/session.ts`, `mobile/contexts/AuthContext.tsx`):
  stored tokens + cached user restore the session with zero requests. Refresh is lazy (on 401 or
  < 60 s to expiry, judged on server time), single-flight, token in the body. Only a rejected refresh
  (`SESSION_EXPIRED`) or `ACCOUNT_NOT_FOUND` ends the session; offline/5xx/HTML answers never do. Every request has an 8 s `AbortController` timeout.
- **Outbox** (`mobile/sync/outbox.ts`, `mobile/sync/runtime.ts`): every write type (toggles,
  daily-log fields, CRUD, one-off foods, programs, workout start/sets/finish, preferences,
  profile, score trigger). Coalesces per key, strict order, exponential backoff 2 s → 5 min.
  4xx → dead-letter list shown in Settings (Retry/Discard); 5xx retried 8× then dead-lettered.
  Namespaced per user, cleared on explicit logout. Legacy `onyx_mutation_queue_v1` is migrated.
- **Rehydrate** (`mobile/sync/dayData.ts`): the device keeps a v2 backup blob + a journal of
  confirmed writes. Different `dataEpoch` → `POST /sync/import?v=2` with the backup → replay
  journal → store new epoch.
- **Connectivity** (`mobile/sync/connectivity.ts`): TanStack `focusManager`/`onlineManager`; a failed
  request flips offline, a `/health` probe every 15 s flips back (no NetInfo dependency).

Storage keys (real names). SecureStore: `onyx_access_token`, `onyx_refresh_token` (localStorage on
web). AsyncStorage: `onyx_session_user_v1`, `onyx_last_account_v1`, `onyx_clock_offset`,
`onyx_device_id`, `onyx_server_offset_ms`, `onyx_outbox_v2:<userId>`, `onyx_journal_v1:<userId>`,
`onyx_epoch_v1:<userId>`, `onyx_history_at_v1:<userId>`, `onyx_score_sig_v1:<userId>`,
`onyx_theme_mode`, `onyx_training_intention_v1`, `onyx_program_last_completion_v1`,
`onyx_notification_prefs`, `onyx_recent_foods_v1`, `onyx_achievements_seen`, `onyx_workout_done`,
`onyx_water_<date>` (device-only), card dismissals (`onyx_checkin_dismissed`,
`onyx_getting_started_dismissed`, `onyx_weekly_recap_dismissed`). Blobs: `onyx-query-cache`,
`onyx-backup-v2-<userId>`. The old `andi_weekday_os_v1` keys are only ever removed.

## 6. API surface

Mounted under `/api` in `backend/src/routes/index.ts`; each resource is
`routes → controller → service` with Zod `validate(schema, 'body'|'query'|'params')`.

```
/api/auth      register · login · refresh · logout · me · profile
/api/today     GET ?date=  → everything Today needs in one round trip (+ dataEpoch, score, streak)
/api/schedule  blocks CRUD · GET/POST /completions (HLC toggle)
/api/supplements  CRUD · GET /logs · POST /:id/log (HLC toggle)
/api/meals     /templates CRUD · PATCH /templates/:id/grams · POST /one-off · GET /logs · POST /:id/log
/api/logs      GET / · /stats · /:date · POST / · PATCH /:date (field-level, HLC) · DELETE /:id
/api/workouts  /sessions · DELETE /sessions/:id · /sessions/:id/sets · /sessions/:id/finish · /sets/:id · /exercise-history · /exercise-sessions
/api/programs  CRUD (days[].weekdays)        /api/preferences  GET · PUT
/api/scores    GET ?days= (v1) | ?v=2 · POST (recompute trigger only)
/api/sync      GET /export[?v=2] · POST /import[?v=2] · GET /state · POST /seed-starter
/api/foods  /api/user-foods  /api/exercises  /api/supplement-db  /api/health
```

Contract details for sync: `docs/log/backend-sync-api.md`. Envelope:
`{ success, data?, error?, message?, code? }` (client adds `status?`, `networkError?`). Errors: services throw
`AppError` (`backend/src/utils/errors.ts`); Prisma P2025 → 404, P2002 → 409, P2003 → 400;
malformed JSON → 400, too large → 413, CORS → 403, 500s never leak stacks; unknown `/api/*` → 404
envelope. Body limit 100 kB, 10 MB only on `/api/sync/import`. Rate limits: general 100/min, auth
5/min, refresh 30/min (keyed by `req.ip`, IPv6 /64). Auth: HS256 pinned, `typ` claim, access 15 min,
refresh 7 d rotated with reuse detection (family revoked); logout revokes the family's access tokens
immediately. Ownership: foreign ids → 404 (IDOR matrix test). `backend/src/config/env.ts` validates
env at import and exits on bad values (secrets ≥ 32 chars and different, `TRUST_PROXY_HOPS` 0–5).

## 7. Conventions

- **ESLint 9 flat config**: `mobile/eslint.config.js`, `backend/eslint.config.js`. `no-undef` off
  for TS; `@typescript-eslint/no-unused-vars` error (ignore `^_` args, `^[A-Z_]` vars).
  **Spread/rest is allowed** (the old no-spread rule was dropped). Mobile **bans barrel imports**
  via `no-restricted-imports`: use `@expo/vector-icons/Ionicons` and font weight subpaths
  (`@expo-google-fonts/archivo/700Bold`), never the package roots (bundle budget).
- **Prettier 3** (printWidth 90, semi, trailingComma es5): **backend `singleQuote: true`**
  (`backend/.prettierrc`), **mobile `singleQuote: false`** (`mobile/.prettierrc`). Both are
  enforced by `npm run check`. Line endings LF (`.gitattributes`).
- **Naming**: components PascalCase; routes lowercase Expo Router files; hooks/utils camelCase.
- **Import order**: React/RN/external → contexts & hooks → components → utils/data/types → theme.
- Side-effect-free logic goes in `mobile/utils/` (or `mobile/sync/` for the data layer) with a test.
- React 19 / react-hooks: narrow `result.data` into a const before `setState` closures; suppress
  `react-hooks/set-state-in-effect` inline only for real fetch/prop-sync effects; `useCallback`
  only where identity matters.
- **Theming** (`mobile/theme.ts`): dark + light palettes; `ThemeContext` follows the OS live
  (`userInterfaceStyle: automatic` in `mobile/app.json`) with a System/Light/Dark override saved in
  `onyx_theme_mode`. Use `useTheme()`; the module-level `colors` export is only for code outside
  the provider. Tokens: `spacing`, `radii`, `fontSizes`, `typeRamp`, `iconSizes`, `zLayer`, `motion`,
  `elevation`, `tints`, `getTagColors()`, and **`floating`** (`fabSize`, `fabBottom`, `fabTop`,
  `toastBottom`, `contentInset`) for anything that must clear the quick-log "+" FAB.
- **Accessibility** (enforced by unit tests in `npm run check`):
  - every declared text/UI colour pair passes WCAG AA (4.5:1 text, 3:1 large/UI) in both palettes —
    `mobile/theme/__tests__/contrast.test.ts`;
  - every touchable has `accessibilityRole` (or `accessible={false}`), and icon/glyph/backdrop-only
    touchables have `accessibilityLabel` — `mobile/components/__tests__/touchables.a11y.test.ts`;
  - touch targets ≥ 44 pt via `minHeight` or `hitSlop` (convention, reviewed, not test-enforced);
    respect reduced motion.
- Render cost: `mobile/contexts/__tests__/renderCounts.test.tsx` guards re-renders per event; the
  workout timer ticks in leaf components (`useWorkoutClock`), not in context.

## 8. Testing & judges

One runner, `scripts/check.mjs`, wired as `npm run check` in each package; it stops at the
first failing judge and prints a summary. `CHECK_SKIP=e2e,bundle` / `CHECK_ONLY=tsc` narrow it.

```bash
cd backend && npm run check   # tsc · eslint src/ · prettier --check src test · unit · api · migrations · docs
cd mobile && npm run check    # tsc · eslint . · prettier --check . · unit · config · bundle · e2e smoke · docs
cd mobile && npm run check:docs   # only the AGENTS.md judge (same script in backend)
```

- **Local DBs**: repo-root `.env.check.local` (gitignored, never overrides real env) with
  `TEST_DATABASE_URL=postgresql://<user>:<pw>@localhost:<port>/onyx_test` and
  `E2E_DATABASE_URL=…/onyx_e2e_test`; `MIG_DATABASE_URL` defaults to `onyx_mig_check` on the
  same server. Without `TEST_DATABASE_URL` the api/migrations judges print a loud SKIPPED banner.
- **DB safety guards** — never weaken them, never point a judge at production:
  `backend/test/globalSetup.ts` and `e2e/scripts/env.mjs` refuse non-local hosts and DB names not
  ending in `_test` (they run `prisma migrate reset`); `backend/scripts/check-migrations.mjs`
  refuses non-local hosts and names without `mig_check` (it drops the schema);
  `e2e/scripts/env.mjs` also refuses a non-local API.
- **API tests** (`npm run test:api`): every route needs a 2xx and a 4xx test — the run fails if
  `backend/test/apiCoverage.ts` finds a gap; `backend/test/routeCoverage.test.ts` fails if a
  mutating route lacks `validate`, a `:param` route lacks params validation, or a private route
  lacks `authMiddleware`; `backend/test/idor.api.test.ts` reads `:param` routes from Express, so a
  new route must be added to the matrix. Property tests: `backend/test/convergence.api.test.ts`,
  `mobile/sync/__tests__/convergence.test.ts`.
- **E2E** (`e2e/`, self-contained: migrates + seeds `E2E_DATABASE_URL`, API on :3201 with
  `DISABLE_RATE_LIMIT=1`, Expo web on :8281; override with `E2E_API_PORT` / `E2E_WEB_PORT`):
  `cd e2e && npm run smoke`, `npm run flows` (tap/time report in `e2e/results/flows.md`),
  `npm run offline`, full suite `E2E_ENFORCE_BUDGETS=1 npx playwright test` (asserts ≤ 2 taps /
  ≤ 5 s per core action). Screens: `E2E_SCREENS=1 npx playwright test tests/screens.spec.ts`.
  First time: `cd e2e && npm run install-browsers`.
- **Perf budgets** (fail loudly):
  - bundle: `cd mobile && npm run perf:bundle` — Hermes ≤ 3.28 MB, assets ≤ 930 KB / 31 files /
    5 fonts (`mobile/scripts/check-bundle-budget.mjs`);
  - `/today`: `cd backend && npm run perf:today` — p95 < 150 ms on one seeded year
    (local `PERF_DATABASE_URL` or `TEST_DATABASE_URL`);
  - cold start: `cd mobile && npm run perf:tti` — Android, logcat `ONYX_PERF` marks
    (`mobile/utils/perfMarks.ts`), p50/p90; target < 1.0 s (last: p50 2.34 s, emulator).
- Other scripts: `cd backend && npm run db:verify-deploy` (migrate-deploy scenarios),
  `cd backend && npm run perf:bench` (legacy startup benchmark; run `npm run perf:seed` first);
  `cd mobile && npm run test:config` (cleartext rule, also a judge).
- CI (`.github/workflows/ci.yml`, Node 22, Postgres 16 services): jobs backend `npm run check`
  (migrations skipped), migrations (`npm run db:check-migrations`), mobile `npm run check`
  (`CHECK_SKIP=e2e`), e2e (smoke + flows).

## 9. Android build notes

- Build with `scripts/android/build-release.ps1` (`-Name`, `-ApiUrl`, `-Install`): it copies
  `mobile/` to a **short path** (`C:\Users\<you>\onyx-build-<Name>`) because CMake/ninja paths
  from a worktree exceed Windows' 260-char limit, then `expo prebuild` + `gradlew assembleRelease`.
  Under memory pressure retry with fewer Gradle workers.
- **Cleartext HTTP only for local APIs**: `mobile/app.config.ts` adds `usesCleartextTraffic` only
  when `EXPO_PUBLIC_API_URL` is `http://10.0.2.2|localhost|127.0.0.1`; production uses the https URL
  in `mobile/app.json` (`extra.apiUrl`). Cases are asserted by `scripts/test-app-config.mjs`.
- Cold start: `scripts/android/coldstart.ps1 -Runs 10` (Maestro bracket) or `npm run perf:tti`
  (direct marks). Maestro flows: `e2e/maestro/login.yaml`, `e2e/maestro/coldstart-focus.yaml`,
  `e2e/maestro/offline-coldstart.yaml`. Package id `com.onyx.daily`; AVD used so far: `onyx_pixel`.

## 10. Deployment

- **Render free** (`backend/render.yaml`): web service `onyx-api` + Postgres `onyx-db`, both
  `plan: free`. Build `npm install && npm run build`; start
  `bash scripts/migrate-deploy.sh && npm start`.
- `backend/scripts/migrate-deploy.sh`: if the DB was built by `db push` (tables, no
  `_prisma_migrations`), it aligns it to `backend/prisma/baseline/schema.baseline.prisma`, marks the
  six baseline migrations applied, then `prisma migrate deploy`; fresh/migrated DBs go straight to
  `migrate deploy`. Verified by `npm run db:verify-deploy`.
- Env: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `NODE_ENV`, `PORT`,
  `TRUST_PROXY_HOPS` (default 1; read `[proxy-chain]` in the boot log and set hops − 1 — not yet
  confirmed on Render). `DISABLE_RATE_LIMIT` is ignored in production.
- **The free DB can expire/be wiped (≈ monthly)**. That is by design now: the device holds the
  history and **rehydrates** the server on the next `/today` (dataEpoch, §5). Users also have
  Settings → "Export my data" (full v2 JSON). Prod health: `https://onyx-api-wmis.onrender.com/api/health`
  (read-only probe; never run judges or writes against production).

## 11. Where docs live

- `docs/AMBITION_PLAN.md` — the approved plan (bets, targets, decisions); `docs/AMBITION_LOG.md` —
  dated before → after results per slice. New plans go to the plan, results to the log.
- `docs/audit/` — evidence-backed audits 01–07 (architecture, sync, security, score, training &
  nutrition, UX/a11y, performance) + `docs/audit/scripts/` and `docs/audit/evidence/`.
- `docs/log/` — per-workstream implementation logs; `docs/log/backend-sync-api.md` is the sync
  contract the client implements; screenshots in `docs/log/screens/`.
- `docs/HEALTH_ROUTINE.md` — weekly/monthly checklist for running Onyx without the owner.
- `contracts/README.md` — Outcome Score + streak spec shared by both packages.
- `docs/archive/` — superseded planning docs, each with a status header.

## 12. Known limits (don't rediscover them)

- No delta sync. Daily-log deletes are not tombstoned (a newer field write re-creates the date).
- `PATCH /api/meals/templates/:id/grams` is an unclocked legacy edit.
- The in-progress workout position (exercise/set/rest/timers, `mobile/utils/workoutPosition.ts`)
  is saved in the outbox record (aux) and restored after a kill only when the day and the
  program rows match; undo of the last set is not restored.
- Water and "achievements seen" are device-only.
- Rehydrate e2e (`e2e/tests/sync-resilience.spec.ts`) wipes rows + rotates the epoch with the
  account kept; the "account deleted → re-register" path is unit/backend-tested only.
- `mobile/metro.config.cjs` resolves `assert` for `@ide/backoff` (expo-notifications) to
  `mobile/shims/assert.js`; the npm `assert`/`util` polyfills cost ~74 KB of Hermes bytecode.
- Early-warning nudge is off (`FEATURE_FLAGS` in `mobile/utils/reminderPlan.ts`) until a real-data
  rerun justifies it.

---

**Last Updated**: 2026-10-18
**Review cycle**: update in the same commit as any structural change; `npm run check` fails on stale paths/scripts.
