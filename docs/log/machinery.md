# Machinery log (Bet 14 + Bet 8 measurement harness)

Branch `worktree-agent-a03943dff671d8097`, based on `main` @ 3275a4e. 2026-10-17.

## What exists now

| Judge | Where | How to run |
|---|---|---|
| Backend check: tsc, eslint src/, prettier --check src test, vitest unit, **API tests** (when `TEST_DATABASE_URL` is set; otherwise a loud `!!! SKIPPED` banner) | `scripts/check.mjs backend` | `cd backend && npm run check` |
| Mobile check: tsc, eslint, prettier --check, vitest, **app-config assertions**, **bundle budget**, **e2e smoke** | `scripts/check.mjs mobile` | `cd mobile && npm run check` (`CHECK_SKIP=e2e,bundle` / `CHECK_ONLY=tsc` to narrow) |
| E2E smoke (self-contained servers) | `e2e/tests/smoke.spec.ts` | `cd mobile && npm run e2e:smoke` (or `cd e2e && npm run smoke`) |
| Core-action tap/time flows + offline baseline | `e2e/tests/flows/`, `e2e/tests/offline.spec.ts`, `e2e/lib/flow.ts` | `cd mobile && npm run e2e:flows` → `e2e/results/flows.{json,md}` |
| Cleartext only for local http APIs | `mobile/app.config.ts`, `scripts/test-app-config.mjs` | `cd mobile && npm run test:config` |
| Android release build (short path) | `scripts/android/build-release.ps1` | `powershell -File scripts/android/build-release.ps1 -Install` |
| Android cold start p50/p90 | `scripts/android/coldstart.ps1` | `powershell -File scripts/android/coldstart.ps1 -Runs 10` |
| CI | `.github/workflows/ci.yml` | jobs: backend, migrations, mobile, e2e |

The runner fails fast and ends with a summary naming the failed judge, e.g.

```
check summary: backend
  pass     tsc       6.5s
  ...
CHECK FAILED: judge "prettier" (npx prettier --check src test) in backend/
```

### Local database setup

Local runs read an optional, gitignored `.env.check.local` at the repo root (KEY=VALUE;
never overrides real env vars):

```
TEST_DATABASE_URL=postgresql://<user>:<pw>@localhost:5432/onyx_ci_test
E2E_DATABASE_URL=postgresql://<user>:<pw>@localhost:5432/onyx_e2e_test
```

Both guards (backend/test/globalSetup.ts and e2e/scripts/env.mjs) refuse non-local hosts
and any DB name not ending in `_test`. Note: the brief asked for `onyx_test_ci`; that name
fails the existing `_test` guard, so the DB is `onyx_ci_test`.

### Self-contained Playwright

`e2e/playwright.config.ts` has two `webServer` entries (both `reuseExistingServer`):

- `node scripts/start-api.mjs` → `prisma db push --force-reset` into `E2E_DATABASE_URL`,
  reference seed (foods, programs, exercises, supplement DB), API on **:3201** with
  `DISABLE_RATE_LIMIT=1`, `NODE_ENV=test`, CORS for :8281.
- `npx expo start --web --port 8281` with `EXPO_PUBLIC_API_URL=http://localhost:3201/api`.

`global-setup.ts` registers the fixture user and warms Metro (requests the entry bundle) so
the first test does not pay bundling inside its timing window. `outputDir` moved to
`results/artifacts` so Playwright's per-run cleanup no longer deletes `results/flows*`.
`npm run smoke` / `flows` run `tsc --noEmit` first (a ReferenceError hidden behind
`test.fail()` is how I found that this is needed).

### Tap/time instrument (`e2e/lib/flow.ts`)

Every interaction in a measured flow goes through `flow.tap` / `flow.type`:

- **taps** = clicks; **inputs** = text fields filled; **screens/sheets** = route changes
  (counted automatically from `framenavigated`, incl. pushState) plus `flow.sheet()` for
  sheets/modals; **scrolls** = a target that was outside the viewport (IntersectionObserver)
  before Playwright scrolled it in; **wall time** = `begin()` → confirmation visible.
- `flow.assist()` = an uncounted click that stands in for passive time (Skip rest instead of
  waiting 90 s under a fixed clock).
- `guarded()` writes partial counts as `BLOCKED` when a flow cannot complete; paired with
  `test.fail()` for a known bug so the test flips to "unexpectedly passed" when it is fixed.
- Budgets ≤ 2 taps / ≤ 5 s are reported; `E2E_ENFORCE_BUDGETS=1` makes them soft
  assertions (the redesign turns this on).
- Each flow: fresh user via API → seed via public API (schedule, 3 AM supplements at 08:00,
  a planned meal, program "Beginner Full Body · Full Body A" + last week's session so set
  values prefill) → `page.clock.setFixedTime(<today hh:mm>)` where time of day matters →
  UI sign-in → Focus → measure. Getting-started card pre-dismissed (steady-state user).

Wall times are **machine** times (Playwright on a desktop): a floor for human time, useful
for before/after comparison on the same instrument, not as a human-speed claim.

## Baseline (current UI, Expo web, Pixel 7 viewport) — 2026-10-17

Cold servers started by Playwright; same numbers within ±0.3 s over 3 runs.

| # | Action | Taps | Text inputs | Screens/sheets | Scrolls | Wall time | ≤2 taps & ≤5 s |
|---|---|---|---|---|---|---|---|
| 1 | Log a set (workout active) | 1 | 0 | 0 | 0 | 0.19 s | yes |
| 1b | First set of the day (Start → Set 1 done) | 2 | 0 | 0 | 0 | 0.36 s | yes |
| 2 | Mark workout done (14 sets, no direct action) | 15 | 0 | 0 | 0 | 3.5–5.2 s | **no** |
| 3 | Log a planned meal | 1 | 0 | 0 | 0 | 0.23 s | yes |
| 4 | Ad-hoc food (search) | ≥3 | ≥1 | ≥3 | 0–1 | – | **BLOCKED** (bug B2) |
| 5 | Scan barcode | – | – | – | – | – | N/A on web (camera) |
| 6 | Take one supplement | 1 | 0 | 0 | 0 | 0.19 s | yes |
| 6b | Take all AM supplements (3) | 3 | 0 | 0 | 0 | 0.47 s | **no** |
| 7 | Tick a schedule block (via Schedule tab) | ≥2 | 0 | ≥1 | 0 | – | **BLOCKED** (bug B3) |
| 8 | Log bodyweight (Settings → History) | 3 | 1 | 2 | 0 | 0.81 s | **no** |
| 9 | Log sleep (Settings → History) | 3 | 1 | 2 | 0 | 0.67 s | **no** |
| 10 | Evening check-in (card on Focus after 19:00) | 1 | 3 | 0 | 0 | 0.28 s | yes (3 fields typed) |
| 11 | See what's next today | 0 | 0 | 0 | 0 | 0.02 s | yes |

Versus audit 06 §1 (read from code): matches for 1, 1b, 3, 6, 6b, 10, 11. Workout done is
15 taps (14 sets + Start) vs ≈16. Weight/sleep are **3 taps + 1 input** on a Pixel 7
viewport — the audit's 4th "tap" was a scroll that this viewport does not need. Ad-hoc food
and schedule tick could not complete on web at all (below).

### Offline baseline (`e2e/tests/offline.spec.ts`, both `test.fail`)

- `context.setOffline(true)` + reload: blank page (the web build has no service worker, so
  the shell itself cannot load) — this variant mostly tests the browser.
- Device-like variant (only `/api/*` aborted, bundle available): Focus renders **empty**
  ("Day score 0/0 done", "Rest day", no meals/supplements) — no persisted state; matches the
  Android airplane-mode result (Login screen) in spirit. Both flip when Bet 1 lands.

## Findings (real product bugs surfaced by the harness)

- **B1 — web session restore always 401s; user dropped right after login.**
  `mobile/api/auth.ts refreshToken()` posts no body and relies on the httpOnly cookie. A
  cross-origin `fetch` from Expo web (:8281 → :3201, default `credentials: same-origin`)
  never sends or stores it. The AuthProvider re-runs `restoreSession` after sign-in (seen
  as a second `POST /auth/refresh`), gets 401, and leaves `user=null`; `DataContext` then
  drops the queries and Focus renders an empty day while still showing "Day score". The old
  smoke test passed anyway (it only waits for "Day score"). The harness works around it in
  `e2e/lib/session.ts` (`installRefreshShim`: puts the stored refresh token in the body,
  which the endpoint already accepts — emulating the native cookie jar). Fix belongs to the
  auth owner: send `{ refreshToken }` from secure storage in `refreshToken()`.
- **B2 — Nutrition hits its error boundary after adding a searched food** (web):
  `ErrorBoundary caught: Error: AnimatedValue: Attempting to set value to undefined`
  (react-native-web's vendored Animated) right after "Added Chicken Breast (cooked)". The
  sheet can't be closed; the new meal can't be ticked. Not verified on native.
- **B3 — schedule tick is saved but never rendered.** `hooks/useCompletion.ts`
  `applyLocal` does `next = ensureState(Object.assign({}, prev)); next.completion[day] = …`:
  `ensureState` keeps the same `completion` object, so the write mutates the cached state in
  place; TanStack Query's structural sharing then sees an identical tree and returns the old
  reference, so nothing re-renders (`POST /schedule/completions` → 200; the following
  `POST /scores` still says `tasksDone: 0`). Pure JS, so native is affected too. Fix: copy
  `completion` (and the day map) before writing.

## Android (Bet 14 step 5)

Verified end-to-end on emulator-5554 (`onyx_pixel`, sdk_gphone64_x86_64), API on :3201.

1. `powershell -File scripts/android/build-release.ps1 -Install` — robocopies `mobile/` to
   `C:\Users\andi\onyx-build-mach` (short path: the worktree prefix pushes CMake/ninja
   object paths past Windows' 260-char MAX_PATH), `npm ci`, `expo prebuild --platform
   android`, `gradlew assembleRelease -PreactNativeArchitectures=x86_64`, `adb install -r`.
   Generated manifest has `android:usesCleartextTraffic="true"` (from `app.config.ts`,
   because `EXPO_PUBLIC_API_URL=http://10.0.2.2:3201/api`). First attempt: Gradle native
   part fine, then `:app:createBundleReleaseJsAndAssets` failed with
   `A jest worker process (pid=20580) was terminated by another process: signal=SIGTERM`
   (Metro worker killed under memory pressure — other agents were building in parallel);
   the incremental retry passed: **BUILD SUCCESSFUL in 3m 47s** (4.1 min incl. copy).
   Clean first build ≈ 7.5 min + npm ci 1 min.
2. `powershell -File scripts/android/coldstart.ps1 -Runs 10` — registers the fixture user,
   signs in once (Maestro `login.yaml`), then 10× force-stop + `am start -W` and 10×
   Maestro `coldstart-focus.yaml`. Output `e2e/results/coldstart.json`:

| Measurement (logged in, release, local API) | p50 | p90 | samples |
|---|---|---|---|
| `am start -W` TotalTime (first frame) | 796 ms | 1093 ms | 555–1112 |
| Maestro flow launch → "Day score" visible (JUnit time, incl. launchApp ≈1.3 s) | 6514 ms | 7068 ms | 5972–8098 |

   These are slower than the §7 numbers (TotalTime avg 400 ms logged-out; 3.2–3.9 s to
   "Day score") because the host was heavily loaded (parallel agents building/testing);
   treat this run as a smoke of the script, re-baseline on an idle machine. A first version
   timed the Maestro CLI with a stopwatch and got 13–17 s — that is JVM + device-connect
   overhead, so the script reads Maestro's JUnit `testcase/@time` instead.

Only a PowerShell script exists (`coldstart.ps1`); a bash twin was not written.

## CI notes

- `.github/workflows/ci.yml` validated with `npx yaml-lint` and
  `npx @action-validator/cli@0.6.0` (schema) — both clean. Actions cannot run locally; each
  job's commands were dry-run locally in order (`npm ci` then the job's steps) — all green
  (see report).
- Lockfiles: `npm ci` succeeds in backend/, mobile/, e2e/ at this base (Bet 12 had already
  regenerated them); e2e gained `typescript` + `@types/node`.
- `migrations` job runs `npm run db:check-migrations` only when that script exists (another
  branch adds it); until then it prints a notice.
- Worktree gotcha: this worktree was created before `.gitattributes` (eol=lf) landed;
  after `git reset --hard main` 133 files stayed CRLF and prettier failed on 41 backend
  files. Converting the working copy to LF (content identical to HEAD) fixed it — fresh
  clones are unaffected.

## Not done / next

- Wall-time budget uses machine time; a human-time model (e.g. KLM operators) is not
  applied.
- Barcode (5) and first-set-on-wrong-program-day (1c) have no flow.
- API latency budget (`/today` p95) and render-count judges belong to Bet 1 / Bet 11.
- `docs/HEALTH_ROUTINE.md` (Bet 14) not written.
