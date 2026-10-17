# 02 — Sync, offline writes, multi-device consistency, load path

Audit date: 2026-10-17. Scope: `mobile/` write paths + `backend/` API, measured against the local API
(`http://localhost:3001/api`, DB `onyx_dev`, NODE_ENV=development). Production was never contacted.
Scratch scripts and raw outputs: `%TEMP%\claude\...\scratchpad\sync\` (`auth_races*.mjs`, `bcrypt72.mjs`,
`writes.mjs`, `writes2.mjs`, `crossuser.mjs`, `seedrace.mjs`, `seed_bench.mjs`, `bench.mjs`, `*.out`).

Targets under test:

- **T1** "100% of writes work offline and reconcile deterministically. Zero data loss across app kill,
  reinstall, and two devices editing the same day."
- **T2** "Loading today takes ONE API round-trip, p95 < 150 ms locally."

**Verdict: neither target is met.** About 3 of the ~25 write types have any offline support (the three
daily toggles). That support only works while the process stays alive and already has data loaded. The
app cannot start offline at all. Loading today takes **7 requests** (2 of them serial) on the critical
path. The measured p95 is **173.5 ms** locally.

---

## 0. Architecture facts that drive everything below

| Fact | Evidence |
|---|---|
| The whole day lives only in the in-memory TanStack Query cache. No persister. | `mobile/contexts/DataContext.tsx:105-115` (`useQuery(["appState"])`), `mobile/app/_layout.tsx:61-68` (plain `new QueryClient`, `retry: 1`, `staleTime: 30_000`) |
| The documented cache key `andi_weekday_os_v1` is **never written**. It only appears in `clearStorage()`. | `mobile/utils/storage.ts:4,30-31`. No `setItem` on it anywhere (grep) |
| Writes are raw `api.*` calls inside hooks. No TanStack mutations, no `onlineManager`/`focusManager`/NetInfo. | grep over `mobile/` finds no `useMutation`, `onlineManager`, or `focusManager` |
| The only offline mechanism is `utils/mutationQueue.ts` (AsyncStorage `onyx_mutation_queue_v1`). It covers completion, meal and supplement toggles only. | `mobile/utils/mutationQueue.ts:7-30` |
| Startup requires the network: `restoreSession` always calls `/auth/refresh`, and a failure leaves `user=null`, which redirects to login. | `mobile/contexts/AuthContext.tsx:43-75`, `mobile/app/index.tsx` |
| `fetch` has no timeout. Android OkHttp is built with 0 (infinite) connect/read/write timeouts. | `mobile/api/client.ts:126-129`; `node_modules/react-native/ReactAndroid/.../OkHttpClientProvider.kt:52-54` |

---

## 1. Write-path inventory

Legend: **Opt** = optimistic UI, **Q** = enters persisted queue, **Kill** = survives app kill,
**Retry** = automatically retried, **Idem** = safe to replay (measured where marked ✔m).

| # | Write | Code path → endpoint | Offline behaviour | Opt | Q | Kill | Retry | Idem | Ordering / notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Block completion toggle | `hooks/useCompletion.ts:20-48` → `POST /schedule/completions` | Queued on `networkError` | yes | yes | queue yes, UI state no | flush on mount, foreground and every 60 s (`DataContext.tsx:89-101`) | upsert `(userId,blockId,date)` ✔m | Latest-per-key inside the queue only (`mutationQueue.ts:80-85`). A later *successful* direct write does not remove the stale queued entry (see §2.4). Dropped on any non-network failure (401/400/404/429) and after 7 days (`mutationQueue.ts:105-111`) |
| 2 | Meal eaten toggle | `hooks/useMeals.ts:22-48` → `POST /meals/:id/log` | same as 1 | yes | yes | queue | same | upsert ✔m | same as 1 |
| 3 | Supplement taken toggle | `hooks/useSupplements.ts:21-51` → `POST /supplements/:id/log` | same as 1 | yes | yes | queue | same | upsert ✔m | same as 1 |
| 4 | "Clear all" supplement checks | `useSupplements.ts:130-147` → N × `POST …/log` | fails (toast) | no | no | – | no | upsert | `Promise.all`. Partial failure leaves the server half-cleared and the UI unchanged |
| 5 | Workout session start | `hooks/useWorkout.ts:269-273` → `POST /workouts/sessions` | **silently lost** (`.catch(()=>{})`) | – | no | no | no | **no** — duplicate row ✔m | If it fails, `sessionIdRef` stays null and **every set of that workout is never sent** (`useWorkout.ts:326-327`) |
| 6 | Set log | `useWorkout.ts:329-348` → `POST /workouts/sessions/:id/sets` | **silently lost** | local only | no | no (session state is in-memory refs) | no | **no** — duplicate set ✔m | No client id or idempotency key. App kill mid-workout loses position and unsent sets |
| 7 | Set undo | `useWorkout.ts:442` → `DELETE /workouts/sets/:id` | silently lost | yes | no | no | no | yes | Only works if the POST response has already arrived (`serverId`) |
| 8 | Session finish | `useWorkout.ts:276-281` → `PATCH …/finish` | silently lost | – | no | no | no | yes | |
| 9 | "Workout done today" flag | `useWorkout.ts:365` AsyncStorage `onyx_workout_done` | local only | – | – | yes | – | – | **Never synced.** Device B doesn't know about it, so it posts `workoutDone:false` to DailyScore (§3.6) |
| 10 | DailyScore snapshot | `app/(tabs)/focus.tsx:266-296` → `POST /scores` (1.5 s debounce) | silently lost | – | no | no | re-sent on the next state change only | upsert ✔m | **Computed on the client, last-writer-wins, no version** (§2.6) |
| 11 | Daily log (bw/sleep/steps/top/notes) | `hooks/useLog.ts:14-43` → `POST /logs` | fails (toast) | no | no | no | no | upsert ✔m | Whole-row overwrite, so fields clobber across devices (§2.7) |
| 12 | Daily log delete / clear all | `useLog.ts:45-77` → `DELETE /logs/:id` ×N | fails | no | no | – | no | yes | `clearLogEntries` partial failure leaves a mixed state |
| 13 | Schedule block create | `useCompletion.ts:97-126` → `POST /schedule` | fails (toast) | no | no | – | no | **no** ✔m | Ambiguous commit: server commits after the client hangs up ✔m (§2.2) |
| 14 | Schedule block update/delete | `useCompletion.ts:50-95` → `PUT/DELETE /schedule/:id` | fails | no | no | – | no | PUT yes | Partial-field PUT, last-writer-wins per field |
| 15 | Supplement create/update/delete | `useSupplements.ts:53-128` | fails | no | no | – | no | create **no** ✔m | |
| 16 | Meal template create/update/delete | `useMeals.ts:50-133` | fails | no | no | – | no | create **no** ✔m | `grams`/`foodId` are written but **not returned by `/sync/export`** (§3.7) |
| 17 | Program select (prefs) | `hooks/useProgram.ts:47-53` → `PUT /preferences` | silently lost | – | no | no | no | yes | Fires on **every launch**, so the last-launched device wins the program/day selection |
| 18 | Profile / caffeine cutoff | `app/(tabs)/settings.tsx:90-93` → `PUT /auth/profile`, `PUT /preferences` | result ignored | – | no | – | no | yes | No error handling |
| 19 | Protein target apply | `app/(tabs)/nutrition.tsx:231` → `PUT /preferences` | fails | – | no | – | no | yes | |
| 20 | Program create/update/delete | `app/program-editor.tsx:192-193`, `app/(tabs)/program.tsx:131` | fails | no | no | – | no | create **no** | |
| 21 | Saved foods add/remove | `app/(tabs)/nutrition.tsx:200,214` → `/user-foods` | fails | no | no | – | no | yes (unique) ✔m | |
| 22 | Import | `hooks/useImportExport.ts:72-89` → `POST /sync/import` | fails | no | no | – | no | replace-all | Deletes and recreates every row with **new IDs** (`sync.service.ts:94-145`) ✔m (§2.9) |
| 23 | Starter seed | `app/onboarding.tsx:57` → `POST /sync/seed-starter` | fails | – | no | – | no | **no under concurrency** ✔m | Count-check sits outside the transaction (`sync.service.ts:41-51`). 5/5 concurrent trials doubled the data |
| 24 | Water | `hooks/useWater.ts` AsyncStorage `onyx_water_<date>` | local only | – | – | yes | – | – | **Never synced.** Lost on reinstall; invisible to the other device |

Ordering: there is no per-key serialization in the hooks, no client timestamp or version on any write,
and no server-side ordering check. The server applies requests in arrival order.

---

## 2. Break attempts against the local API (two sessions of one user = devices A and B)

All results are from real requests (`writes.out`, `writes2.out`, `auth_races*.mjs`, `crossuser.out`, `seedrace.out`).

### 2.1 Duplicate POST (retry after the response was lost)

```
DUP completion toggle:      200/200 SAME id (idempotent)
DUP supplement log:         200/200 SAME
DUP meal log:               200/200 SAME
DUP daily log:              201/201 SAME
DUP score:                  200/200 SAME
DUP user-food add:          200/200 SAME
DUP schedule block create:  201/201 DIFFERENT -> duplicate row
DUP supplement create:      201/201 DIFFERENT -> duplicate row
DUP meal template create:   201/201 DIFFERENT -> duplicate row
DUP workout session start:  201/201 DIFFERENT -> duplicate row   (3 sessions for one day)
DUP workout set log:        201/201 DIFFERENT -> duplicate row   (Bench set 1 stored twice)
```

Every create endpoint is non-idempotent. None of them accepts a client-generated id or an `Idempotency-Key`.

### 2.2 Server committed, client never saw the response

The request body was fully written and the socket destroyed before the response was read (the equivalent of an app kill or timeout):

```
HANGUP POST /schedule:  rows before/after 7 / 8        -> committed, client thinks it failed
HANGUP POST set:        sets on session 1              -> a retry would create a 2nd identical set
```

### 2.3 Toggle on/off race (two quick taps, or two devices)

- Loopback with no jitter: 0/50 trials diverged.
- With 0–120 ms per-request jitter and taps 60 ms apart: **the final server state ≠ the last tap in 5/60 trials.**
  The UI keeps showing the last tap. Nothing refetches to reconcile it.

### 2.4 Offline-queue replay overrides a newer online action (deterministic)

Sequence: offline tap ON (queued) → back online, tap OFF (direct POST succeeds) → flush replays the queued ON.

```
QUEUE-REPLAY: last user action OFF, server final isComplete = true
```

Cause: `enqueueToggle` only dedupes against other queue entries (`mutationQueue.ts:80-85`). The hooks never
remove a queued entry when a later direct write for the same key succeeds (`useCompletion.ts:35-36`,
`useMeals.ts:37-38`, `useSupplements.ts:41`).

### 2.5 Dates and clock skew

- The day key is computed **on the device**, in local time (`utils/storage.ts:7-13`). The server never derives or checks "today" for writes.
- Validation is regex-only:

  ```
  DATE 2026-02-31 / 2026-13-45 / 9999-99-99 / 1970-01-01: completion 200, score 200
  ```

- Server-side reads use **UTC**:
  - `scores.service.ts:41-43` (`getScores` cutoff)
  - `logs.service.ts:58-60` (stats)
  - `sync.service.ts:389` (`getFullState` "today")

  `UserPreferences.timezone` is stored (`auth.service.ts:31`) but never used.
- Effects:
  - A device with a wrong clock, or two devices in different time zones, write the same real day under different keys.
  - Between 00:00 and 02:00 CEST, server-UTC "today" ≠ client "today".
- Rollover: `todayKeyValue` is polled every 60 s and re-checked on foreground (`DataContext.tsx:70-85`). Taps in the first ≤60 s after midnight in a foreground session are written to yesterday.
- `selectedMealDay` is initialised once and never rolls over (`useMeals.ts:19-20`).

### 2.6 Concurrent edits of the same day: DailyScore clobber

```
A posted {score 80, workoutDone true, protein 150}; B (stale view) posted zeros
-> server: {"score":0,"workoutDone":false,"protein":0}
```

Three ways this happens in the app:

1. Device B never refetches (§3.3) yet re-posts its stale snapshot whenever its own state changes.
2. `workoutDone` comes from device-local AsyncStorage (row 9).
3. **After a failed initial load**, the effect only checks `stateLoading`, not `loadError` (`focus.tsx:268`). `appState` is `EMPTY_STATE`, so the app posts a zero score for today 1.5 s later. A cold Render start can trigger this (§5).

DailyScore drives streaks, achievements and insights, so a single clobber breaks streaks.

### 2.7 Daily log field clobber

```
A saved bw=81.2, B (form without bw) saved sleep=7.5 -> server {"bw":"","sleep":"7.5","day":""}
```

`POST /logs` upserts the whole row (`logs.service.ts:38-48`), and the client sends `""` for empty fields.

### 2.8 Delete vs toggle across devices

```
B toggles a supplement A deleted -> 400 "Referenced record not found"
```

The response is non-network, so `flushMutationQueue` **drops it silently** (`mutationQueue.ts:107-111`).

### 2.9 Import on one device

```
IMPORT: block id stable? false | B toggles old block id -> 400 Referenced record not found
```

Every cached ID on the other device, and every toggle in its queue, becomes invalid and is dropped.
Import also leaves DailyScore, workouts, programs and user-foods untouched, so after a "restore"
the scores no longer match the restored logs.

### 2.10 Refresh-token rotation races between devices

| Scenario | Result |
|---|---|
| Device B logs in → does device A survive? | A refresh 200 (OK) |
| A fires two concurrent refreshes with the same token | 200 / 200, and B is still OK |
| A's refresh commits but the response is lost; A retries with the **old** token | **200** — the old token still works, and the rotated token A never saw also works |
| **B logs out the way the app does** (`POST /auth/logout`, bearer only, no body: `api/auth.ts:77-78`) with no cookie | **A's next refresh → 401. Logging out on B logs out A.** |
| B's access token after logout | `/auth/me` still 200 (stateless JWT, valid for 15 min) |
| Launch-time refresh as the app sends it (no body, cookie only: `api/auth.ts:84-85`) with an empty cookie jar | **401 "No refresh token provided"**, so the user lands on login although SecureStore holds a valid refresh token |

Root cause of the "everything matches" results: **bcrypt only hashes the first 72 bytes.** Each refresh JWT
starts with the same header plus `{"sub":"<userId>",…` prefix, so the first 72 bytes are identical for all
of a user's tokens:

```
first 72 bytes equal: true | tokens equal: false
bcrypt.compare(tokenA, hash(tokenB)) = true
```

As a result, rotation and replay detection (`auth.service.ts:107-128`) are ineffective. Any refresh token
of a user matches any stored row for that user. Rotation races therefore do not log users out, but only by
accident. This is also a security defect: a leaked refresh token survives rotation for 7 days, and a
per-device logout deletes an arbitrary row. Logout without the cookie deletes **all** rows
(`auth.service.ts:176-179`, `auth.controller.ts:94-97`).

Other auth paths that affect sync:

- `restoreSession` calls `authApi.refreshToken()`, which bypasses the single-flight `refreshPromise` in `client.ts:63-104`. Two refreshes can therefore run concurrently at startup.
- Refresh tokens are a hard 7 days (`utils/jwt.ts:6`). A device unused for more than 7 days is logged out, and its queue entries also expire (`MAX_AGE_MS` 7 d).

### 2.11 Cross-account replay

Logout does not clear `onyx_mutation_queue_v1`: `clearStorage()` removes only `andi_weekday_os_v1` and the
prefs key (`storage.ts:30-31`). The next account signed in on the device replays the previous account's
toggles, and **the server accepts writes against another user's block, supplement or meal**:

```
user Y toggles user X's block/supp/meal: 200 200 200
```

`toggleCompletion` and the `toggleLog` services upsert on `(userId, targetId, date)` without checking that
the target belongs to `userId` (`schedule.service.ts:60-76`, `meals.service.ts:118`, `supplements.service.ts:64`).

---

## 3. Every client/server divergence found

1. **Cold start offline is impossible.**
   - No query persister. `andi_weekday_os_v1` is never written.
   - `restoreSession` needs the network; on failure the user is redirected to login (`AuthContext.tsx:57-65`, `index.tsx`).
   - App kill = all optimistic state gone. Only the toggle queue survives, and it is invisible until the next successful load.
2. **Queue drops writes on non-network failures** (`mutationQueue.ts:107-111`). The optimistic UI is never rolled back for those dropped items, and the user is not told. The failures that cause drops:
   - **401**: access token expired while offline (15 min) and the refresh hiccups. `client.ts:132-146` returns the 401 JSON, not `networkError`.
   - **429**: the limiter returns JSON at 100 req/min per IP (`middleware/rateLimit.ts:14-23`). Measured 5×429 on 105 requests.
   - **400/404**: target deleted on the other device, or after an import.
3. **No reconciliation after a flush or on the other device.**
   - `flushMutationQueue` never invalidates `["appState"]`.
   - With no `focusManager` or `onlineManager` there is no refetch on foreground or reconnect. The only observer mounts once.
   - Device B stays stale until pull-to-refresh (`focus.tsx:90-93`) or a restart.
4. **Refetch erases pending optimistic state.** Pull-to-refresh while items are queued replaces the cache with server data. The UI reverts while the queue still holds the change. After the flush there is no refetch, so the UI stays wrong until the next manual refresh.
5. **Queue replay reverses newer actions** (§2.4).
6. **DailyScore is computed on the client and is last-writer-wins.** It can be clobbered by a stale device, by device-local `workoutDone`, or by a failed load that posts zeros (§2.6). The server never recomputes it from source rows.
7. **Meal `grams`/`foodId` are missing from `/sync/export`** (`sync.service.ts:318-323`; measured keys `id,name,examples,tags`).
   - After any reload, `computeConsumedMacros` uses `factor = 1` instead of `grams/100` (`utils/nutrition.ts:163`).
   - So protein and calories shown before and after restart differ, and the posted `DailyScore.protein` changes.
8. **Workout data loss offline** (rows 5–8): silent `.catch`, no queue, in-memory session.
9. **Ambiguous commits** on creates are not reconciled (§2.2). Retrying creates duplicates; not retrying leaves "failed" items that actually exist.
10. **Local-only state that never syncs:** water, `onyx_workout_done`, achievements-seen, check-in dismissals. All are lost on reinstall and differ per device.
11. **Reinstall:**
    - AsyncStorage queue is wiped, so all unsynced toggles are lost.
    - On iOS, Keychain (SecureStore) survives reinstall, so the user appears logged in with nothing pending.
    - On Android both are wiped.
12. **Logout keeps the queue** and replays it into the next account (§2.11).
13. **Import ID churn** invalidates the other device's cache and queue (§2.9).
14. **Two time bases**: client local vs server UTC (§2.5).
15. **Partial batch failures** (`clearSupplementChecks`, `clearLogEntries`) leave the server and UI in mixed states.
16. **Program selection ping-pong**: every launch PUTs the device's remembered selection (`useProgram.ts:47-53`).

---

## 4. Loading "today": request count and latency

### 4.1 Requests fired on cold start into Focus (from code)

| Order | Request | Source | Depends on |
|---|---|---|---|
| 1 | `POST /auth/refresh` (bcrypt) | `AuthContext.tsx:58` | – |
| 2 | `GET /auth/me` | `AuthContext.tsx:61` | 1 |
| 3 | `GET /sync/export` (full history) | `DataContext.tsx:105-115` | 2 |
| 4 | `GET /scores?days=30` | `DataContext.tsx:117-127` | 2 |
| 5 | `GET /programs` | `useProgram.ts:20-34` | 2 |
| 6 | `PUT /preferences` (a write on every launch) | `useProgram.ts:47-53` | 2 |
| 7 | `GET /programs/:id` | `useProgram.ts:56-80` | 2 (prefs from `/me`) |
| 8 | `POST /scores` (+1.5 s debounce) | `focus.tsx:266-296` | 3 |
| (9) | `GET /workouts/sessions?limit=50`, Mondays only | `components/focus/WeeklyRecapCard.tsx:65-85` | – |
| (n) | queued toggles replayed one by one, sequentially | `DataContext.tsx:89-101` | 2 |

That is **7 requests on the critical path** (2 serial round-trips, then 5 in parallel), plus 1 deferred write.
The other tabs are lazy and not counted.

**No `/today` aggregate exists.** `GET /sync/state` (`sync.service.ts:367-400`) is the closest thing. It
returns prefs, catalog and today's toggles, but the app doesn't use it, it computes "today" in UTC, and it
omits scores and programs.

### 4.2 Measured latency

Setup:

- Seeded user: 60 days of data.
  - 7 blocks, 4 supplements, 28 meal templates.
  - 60 days of completions, supplement logs, meal logs and daily logs via `/sync/import`.
  - 60 DailyScores.
  - 45 workout sessions with 675 sets.
- Selected program: "Beginner Full Body 3x/Week".
- 60 sequential runs per endpoint after 5 warm-ups, on loopback, Node 24 client. Rate limiter bypassed by rotating `X-Forwarded-For` (see note below).

| Endpoint | p50 ms | p95 ms | max | payload |
|---|---:|---:|---:|---:|
| POST /auth/refresh | **135.0** | **179.9** | 241 | 0.7 KB |
| GET /auth/me | 2.8 | 4.4 | 5 | 0.6 KB |
| GET /sync/export | 8.1 | 11.8 | 13 | **46.4 KB** (unbounded, ~0.77 KB/day) |
| GET /scores?days=30 | 3.1 | 4.3 | 6 | 9.1 KB |
| GET /programs | 2.9 | 4.2 | 5 | 3.4 KB |
| PUT /preferences | 2.6 | 4.7 | 5 | 0.4 KB |
| GET /programs/:id | 2.8 | 3.5 | 4 | 4.6 KB |
| POST /scores | 2.3 | 3.2 | 6 | 0.3 KB |
| GET /workouts/sessions?limit=50 (Mon) | 15.7 | 18.0 | 22 | **196.9 KB** |
| GET /sync/state (unused) | 4.6 | 6.2 | 7 | 26.0 KB |

Simulated app start following the dependency graph (50 runs):

| Scenario | p50 | p95 |
|---|---:|---:|
| Critical path wall time (refresh → me → 5 in parallel) | 148.9 ms | **173.5 ms** (target 150) |
| The same 7 requests fully serial | 174.3 ms | 203.6 ms |

Interpretation:

- About 80% of the budget is the bcrypt refresh on every launch, even when the cached access token is still valid. The data calls themselves take ~12 ms at p95.
- On a real device each serial hop adds a WAN round-trip (×3 hops). `/sync/export` grows without bound (it returns every completion, supplement log, meal log and daily log ever recorded: `sync.service.ts:276-289`).

Rate-limiter note: with `trust proxy = 1` (`app.ts:13`), the general limiter keys on the rightmost
`X-Forwarded-For`, which a direct client controls. Without rotation the local API returned 429 after 100
req/min. The app's own startup burst plus a queue flush can approach that limit from one NAT'd IP, and a
429 drops queued writes (§3.2).

---

## 5. Behaviour against a cold Render instance (30–60 s spin-up)

Derived from code. A cold start was not simulated on device.

1. **No request timeout anywhere.** `client.ts:126` passes no `signal`. Android OkHttp timeouts are 0, meaning infinite (`OkHttpClientProvider.kt:52-54`). iOS gets the XHR `timeout=0` (`RCTNetworking.mm:326`). The first launch blocks for the whole spin-up.
2. **Launch is gated on auth.** `app/_layout.tsx:25-28` shows a bare spinner while `AuthProvider.isLoading`. `restoreSession` is serial (`refresh` → `me`). There is no message, no cancel and no offline fallback.
3. **If Render's edge returns a non-JSON 502/503 during spin-up**, `response.json()` throws and the result is classified as `networkError` (`client.ts:145-152`). `restoreSession` then leaves `user=null`, so the **user sees the login screen as if logged out**. Repeated login taps hit `authRateLimiter`, which allows 5/min (`rateLimit.ts:3-12`).
4. **Data queries** use `retry: 1` with the default delay, then show "Couldn't sync with server — tap to retry" (`focus.tsx:347-351`). The failed load can then post a zero DailyScore (§2.6).
5. **Toggles made during spin-up** keep their fetch pending for 30–60 s. A second tap during that window creates two in-flight writes with no ordering guarantee (§2.3).
6. **A hung request wedges the queue.** `flushing` stays `true` while `await replay()` hangs (`mutationQueue.ts:94-118`), so later flushes no-op until the app restarts.
7. Workout sets started during a cold start are lost if `POST /workouts/sessions` fails or hangs (`sessionIdRef` stays null).

---

## 6. Ranked findings (impact on T1/T2)

1. **P0 — Offline launch impossible and no persisted day cache** (§0, §3.1). This alone fails "100% of writes offline" and "zero loss across app kill".
2. **P0 — Workout session and sets are fire-and-forget with no queue.** They are lost offline, on kill, or on cold start, and duplicated on retry (§1 rows 5–8, §2.1).
3. **P0 — Queue drops writes on 401/429/4xx and replays stale toggles over newer ones** (§2.4, §3.2). The result is nondeterministic, not reconciled.
4. **P0 — DailyScore is client-computed last-writer-wins.** Stale devices or a failed load overwrite it with zeros (§2.6, measured).
5. **P1 — Logout on one device revokes all sessions when the cookie is absent. The bcrypt 72-byte truncation nullifies rotation and replay detection** (§2.10, measured).
6. **P1 — No cross-device reconciliation.** No refetch on foreground or reconnect; flush doesn't invalidate; import churns IDs (§3.3, §2.9).
7. **P1 — Non-idempotent creates with ambiguous commits** (schedule, supplements, meal templates, programs, sessions, sets). The starter-seed race doubled the data 5/5 times.
8. **P1 — Daily log whole-row clobber; `grams` missing from export** (§2.7, §3.7).
9. **P1 — No fetch timeout.** A cold Render instance means a 30–60 s spinner, or a fake logout on 5xx HTML, and a wedged flush (§5).
10. **P2 — Load path: 7 requests, 2 serial; p95 173.5 ms > 150 ms.** No `/today` endpoint; export unbounded (§4).
11. **P2 — Client-local day key vs server UTC; regex-only date validation** (§2.5).
12. **P2 — Queue survives logout and replays into the next account; server accepts cross-user toggles (IDOR)** (§2.11).
