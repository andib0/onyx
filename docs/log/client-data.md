# Log — client data layer (client side of Bets 1, 2, 13)

Date: 2026-10-17. Branch `worktree-agent-a378366cb02731344`, merged `main` twice (machinery
@ 92b1524, navigation redesign @ da7c301). Server contract: [`backend-sync-api.md`](backend-sync-api.md).

## What changed

### Bet 1 — local-first reads, offline session
- **Session without network** (`api/session.ts`, `contexts/AuthContext.tsx`): stored tokens +
  cached user (`onyx_session_user_v1`) restore the session with **zero requests**. No cached
  user (first launch of this version) → one `/auth/me`; if that is offline/5xx/HTML the user
  keeps the session with the identity from the JWT. Only a 401/403/400 from `/auth/refresh`
  (or `ACCOUNT_NOT_FOUND`) signs out — and even then local data stays (namespaced per user).
- **API client** (`api/client.ts`): 8 s `AbortController` timeout on every request;
  non-JSON answers (proxy pages while Render boots) are network-class; refresh is lazy — on
  a 401, or when the access token expires within 60 s, judged on **server time** (offset
  learned from a fresh token's `iat`, so a skewed device clock neither refresh-storms nor
  trusts an expired token); refresh is single-flight and sends the token in the body
  (fixes machinery B1 — web was logged out after sign-in; the e2e shim is gone).
- **Persisted cache** (`sync/persist.ts`, `app/_layout.tsx`): `PersistQueryClientProvider`,
  file-backed on native (`expo-file-system`; AsyncStorage rows > 2 MB fail on Android),
  `buster` `onyx-cache-v1`, max age 60 days, 500 ms throttle + flush on background /
  `pagehide`. Native splash held (`expo-splash-screen`) until fonts + session + cache are
  ready, then Today renders from disk; perf marks `ONYX_PERF js_start | fonts_loaded |
  cache_restored | auth_ready | focus_first_render | focus_interactive`.
- **One `today` query** (`contexts/DataContext.tsx`, `sync/dayData.ts`): key
  `["today", userId, localDate]` → `GET /api/today`, merged into the per-user day cache
  (`["appState", userId]`) with pending writes re-applied; placeholder = newest cached day
  after midnight; revalidated once per launch in the background. Replaces refresh → me →
  `/sync/export` + `/scores` + `/programs` + `/programs/:id` + `PUT /preferences`.
  Programs are persisted queries (6 h stale); the program selection is written only when
  it changes. History (`GET /sync/export?v=2`) is fetched in the background at most daily.
- `focusManager` (RN AppState) + `onlineManager` (no NetInfo in deps: a request that fails
  to reach the API flips offline, a `/health` probe every 15 s / on foreground / browser
  `online` flips back; queries pause instead of erroring).
- Web build only: `public/sw.js` (network-first app shell) so an offline reload still boots.

### Bet 2 — one durable outbox for every write
- `sync/outbox.ts` (pure; storage/transport/clock injected), `sync/intents.ts` (every write
  as data), `sync/applyDay.ts` (pure reducers), `sync/runtime.ts` (per-user engine).
- Write types: completion/supplement/meal toggles, daily-log fields (field-level `PATCH
  /logs/:date`), log delete, schedule/supplement/meal-template CRUD, one-off foods
  (`/meals/one-off`, from the nav merge), programs CRUD, saved foods, workout session start /
  sets / undo / finish / "mark done", preferences, profile, score trigger. Client UUIDs on
  every create; HLC `<ms>-<counter>-<deviceId>` per device (persisted id, clock state saved
  with the queue, physical time clamped to server time when the device runs > 1 h ahead).
- Coalescing per key (latest local wins), log fields keep their own stamp (one PATCH per
  stamp), never-sent create + delete cancel, ops re-sent when coalesced while in flight,
  strict order with exponential backoff (2 s … 5 min), `attempts` persisted before each send.
- Never silently dropped: 4xx → dead-letter list (Settings: "N changes failed to sync" with
  Retry / Discard, `hooks/useSyncStatus.ts`); 404 on a toggle of a deleted target → dropped;
  404 on a delete → done; 5xx retried 8× then dead-lettered; 401 pauses; a "hlc too far in the
  future" 400 re-stamps once.
- Optimistic view = server data ⊕ pending ops (refetches can't erase pending writes, restart
  re-applies them); pure reducers return new objects (fixes machinery B3, the schedule tick).
  Settled ops invalidate the affected queries.
- Outbox and journal are namespaced per user and cleared on explicit logout (after a 3 s
  last-chance flush) — no cross-account replay. Legacy `onyx_mutation_queue_v1` migrated.
- Workouts fully offline: the session id is made on the device, sets are queued at once.
- Quick-log form blanks no longer clear fields that were logged earlier (found by e2e (c)).

### Bet 13 — the device holds the history and rehydrates the server
- Daily export v2 snapshot kept on device (`onyx-backup-v2-<userId>` file) + a journal of every
  confirmed write since it. `/today` → `dataEpoch` compared with the stored one; different
  → `POST /sync/import?v=2` (backup) → journal replayed through the outbox (idempotent) →
  refetch, new epoch stored. Same email re-registered after the server lost the account →
  the old account's outbox/journal/backup/epoch are adopted by the new id.
- Settings → "Export my data": full v2 export from the server, or the device copy offline
  (`expo-sharing`; a download on web).

### Backend (small)
- `PATCH /meals/templates/:id/grams` wrote portion-scaled macros into tags while the app and
  server score scale tags by grams/100 → double scaling. Tags stay per 100 g (+ fat); API test
  pins `/today` macros = tag × grams / 100 once.
- `GymProgram.userId` cascading FK (migration deletes orphans first) + API test.

### From the navigation hand-off
one-off foods through the outbox; `applyIntention` writes via the outbox; `planFor` honours
the training-intention weekdays; `useWorkout.markWorkoutDone()` (+ button next to Start);
redundant supplement-reminder effect removed (ReminderSync owns it).

## Evidence

| Judge | Result |
|---|---|
| mobile `tsc` / `eslint .` / `prettier --check .` | 0 / 0 / clean |
| mobile `vitest run` | 33 files, 322 tests pass |
| outbox property test (fast-check) | **300 runs**, 2 devices, skew ±10 min: 2802 requests, 83 drops, 94 lost responses, 73 duplicates, 141 kills (26 mid-flush), 64 create→delete cancellations — devices + server = max-HLC reference model in 300/300. Mutation check: 4/4 injected bugs caught (server ignores HLC, no re-send after in-flight coalesce, cancel of a maybe-delivered create, coalesced fields stamped with the newest HLC). |
| `npm run perf:bundle` | HBC 3,263,448 / 3,280,000 B; assets 883,283 / 930,000 B; 29/31 files; 5/5 fonts — pass, no budget change |
| backend `tsc` / `eslint src` / `prettier --check src test` / `vitest` | 0 / 0 / clean / 81 pass |
| backend `test:api` (onyx_client_api_test) | 176 pass, route coverage 62/62 |
| `db:check-migrations` (onyx_client_mig_check) | OK, empty diff |
| Playwright (web, API :3301, Expo :8381, `E2E_ENFORCE_BUDGETS=1`) | 23 passed, 2 skipped (screens) |

Playwright specs owned here: `offline.spec.ts` (both flipped from `test.fail` to passing),
`offline-sync.spec.ts` (b) offline block tick + meal + bodyweight → reload offline → state
still shown, 3–4 ops queued, server untouched → online → server equals it; (c) two contexts,
same user, conflicting offline edits (B's later "undone" beats A's earlier "done"; bw from B,
sleep from A) → server and both device caches equal the max-HLC result computed from the
queued stamps; `startup-requests.spec.ts`. Core flow #7 (B3) passes.

## Before → after

| | Before | After |
|---|---|---|
| Requests before Focus can render (logged in) | 7 (refresh → me → export, scores, programs, PUT prefs, program) | **0** — Today renders from disk; 1 background `GET /today` (+ the Monday recap's own list) |
| Offline cold start, logged in | Login screen | Today with cached data (web: Playwright; Android: below) |
| Web launch → Today with data (dev build, Playwright) | 1249 ms sign-in → Focus | reload → data visible ~0.8 s, 0 requests awaited |
| Write types surviving offline + app kill | 3 / ~25 | all (list above) |
| 4xx on a queued write | silently dropped | dead-letter list in Settings |
| Logout | queue replayed into next account | outbox cleared per user |
| Server DB wiped | data gone | device re-imports backup + journal on epoch change |

## Android
(see below — filled in after the emulator run)

## Not done / known limits
- No delete tombstones on the server: a delete from device B can race a delayed create retry
  from device A (the property test restricts deletes to the creating device; documented in
  the contract).
- Entity edits (PUT) are last-arrival-wins on the server (no HLC there); only toggles, sets
  and daily-log fields are HLC-merged.
- An in-progress workout's position (exercise/set/timer) is still in memory; its sets are
  durable, the position is not restored after a kill.
- Water and "achievements seen" stay device-local (no server endpoint).
- The rehydrate path is unit-level + manual reasoning; no automated "wipe server → reopen app"
  e2e yet (the server side is covered by backend `backup.api.test.ts`).
