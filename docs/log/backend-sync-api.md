# Backend sync API contract (Bets 1, 2, 4, 5, 13)

For the client team. Everything here is live on branch `worktree-agent-adcbfed0c9e01848a`
and covered by API tests in `backend/test/*.api.test.ts`. All responses use the usual
envelope `{ success, data?, error?, message? }`. Every existing endpoint stays backward
compatible: new fields are optional, old clients keep working.

## 1. Conventions

### Client ids (idempotent creates)
- Any create of a user-owned row accepts an optional `id` (UUID v4, generated on the
  device). Sending the same create again returns the **same row**: `201` the first time,
  `200` on a replay. The row is **not** modified by a replay (edits go through PUT/PATCH).
- An `id` that belongs to another account → `409 {error: "id already in use"}`. Non-UUID → `400`.
- Applies to: `POST /schedule`, `POST /supplements`, `POST /meals/templates`,
  `POST /programs` (program, `days[].id`, `days[].exercises[].id`), `POST /workouts/sessions`,
  `POST /workouts/sessions/:id/sets`, `POST /logs`, `PATCH /logs/:date`, `POST /user-foods`,
  and the three toggles (`id` is used only if the toggle row is new).
- Workout sets are also unique on `(sessionId, exerciseName, setNumber)`: a repeated set
  without an id updates that set instead of duplicating it.

### HLC (hybrid logical clock)
- Format: `<13-digit unix ms>-<4-digit counter>-<deviceId>`, e.g.
  `1760716800000-0003-pixel6a`. `deviceId` = `[A-Za-z0-9_-]{1,64}` (a UUID works).
- Ordering = plain string comparison (fixed widths make it equal to (ms, counter, device)).
- Reference clock: `backend/src/utils/hlc.ts` `createHlcClock(deviceId, now)` —
  `tick()` per write: `ms = max(lastMs, wallClock)`; counter increments when ms doesn't
  advance; `receive(stamp)` after reading server rows so later local stamps sort after them.
- Rejected with `400`: malformed, or more than 24 h ahead of server time.
- Writes **without** `hlc` behave as before (always apply) — that is the legacy path.

### Dates
- `YYYY-MM-DD`, must be a real calendar date, years 2000–2100 (`2026-02-31` → 400).
- The device's local date is authoritative for writes. Server-side "today" (when the client
  doesn't send a date) uses `UserPreferences.timezone`.

## 2. Writes

| Endpoint | Body additions | Semantics |
|---|---|---|
| `POST /schedule/completions` | `hlc?`, `id?` | LWW toggle. Response row has `hlc` and `applied: boolean` (`false` = a newer write is stored; the row shows the winning value). `404` if the block is missing or not yours (was 400). |
| `POST /supplements/:id/log` | `hlc?`, `id?` | same |
| `POST /meals/:id/log` | `hlc?`, `id?` | same |
| `POST /workouts/sessions` | `id?`, `startedAt?` (ISO) | idempotent; `startedAt` lets an offline device send the real start |
| `POST /workouts/sessions/:id/sets` | `id?`, `hlc?` | upsert per (session, exercise, setNumber); values replaced only by a newer `hlc` |
| `PATCH /workouts/sessions/:id/finish` | `endedAt?` (ISO) | idempotent; keeps the first `endedAt` unless one is sent |
| `PATCH /logs/:date` (**new**) | any of `day,bw,sleep,steps,top,notes` + `hlc?`, `id?` | field-level: absent fields untouched; `""` clears. With `hlc`, each field applies only if newer than that field's clock. Response: row + `fieldClock`, `appliedFields`, `staleFields`. `201` if the row was created, else `200`. |
| `POST /logs` | same fields + `date`, `hlc?`, `id?` | now the same field-level semantics (absent fields are no longer overwritten with `""`). Returns `201` + row. |
| `PUT /preferences` | `proteinTargetG?`, `calorieTargetKcal?`, `goalRateKgPerWeek?` (numbers or null) | targets for the Outcome Score |
| `POST /programs`, `PUT /programs/:id` | `days[].weekdays?: number[]` (ISO 1=Mon … 7=Sun) | planned training days |
| `PUT /auth/profile`, `POST /auth/register` | `heightCm?` (100–250), `sex?` (`male`/`female`) | returned by `/auth/me` and `/today` |
| `POST /scores` | unchanged (still validated) | **ignored** except `date`: triggers a server recompute and returns the server row. Client values can no longer overwrite anything. Plan to stop calling it. |

Deletes are not tombstoned: the client outbox must coalesce (drop a queued create/set
POST once its delete is queued) — a delayed retry of a set POST after its DELETE recreates it.

## 3. `GET /api/today?date=YYYY-MM-DD`

One request with everything Focus needs (`date` optional; default = today in the user's
timezone). Measured p50 16.8 ms / p95 23.8 ms over 200 requests on one seeded year;
22 KB JSON (3.5 KB gzip) vs 269 KB for `/sync/export`.

```jsonc
{
  "date": "2026-10-17", "weekday": "Saturday",
  "serverTime": "2026-10-17T18:00:00.000Z",
  "dataEpoch": "uuid",                       // see §5
  "counts": { "scheduleBlocks", "supplements", "mealTemplates", "dailyLogs", "workoutSessions", "dailyScores" },
  "user": { "id", "email", "username", "age", "weight", "heightCm", "sex", "createdAt" },
  "preferences": { /* UserPreferences row incl. numeric targets */ },
  "schedule": { "blocks": [ScheduleBlock], "completions": [Completion /* date */] },
  "supplements": { "items": [Supplement], "logs": [SupplementLog /* date */] },
  "meals": {
    "templates": [ MealTemplate & { "tags": [...], "grams": number|null, "foodId", "macros": {protein,carbs,fat,calories} } ],   // this weekday
    "logs": [ { "id","mealTemplateId","date","isEaten","eatenAt","hlc","name","dayOfWeek","grams","foodId","macros" } ],
    "consumed": { protein, carbs, fat, calories } | null          // null = nothing eaten
  },
  "program": {
    "selected": { "id","name","goal","isSystem","days":[{ "id","name","dayOrder","weekdays" }] } | null,
    "today": ProgramDay & { "exercises": [...] } | null,  // by weekday if the program has weekdays, else selectedProgramDayId
    "plan": { "plan": "train"|"rest", "setsPlanned", "programDayId", "source": "weekdays"|"session"|"dailyLog"|"default" }
  },
  "workout": { "sessions": [WorkoutSession & { "sets": [...] }], "open": WorkoutSession|null },  // open = unfinished, today or yesterday
  "dailyLog": DailyLog | null,
  "score": {
    "today": Score, "streak": { "count", "state": "kept"|"pending"|"none", "graceUsedThisWeek" },
    "history": [Score]   // last 30 days incl. today
  }
}
```
`Score = { date, outcomeScore (0..100|null=unscored), kept, scored, components {T,Pr,Ca,Bw}, routinePct, plan, setsDone, setsPlanned, protein, calories, workoutDone, tasksDone, tasksTotal, suppDone, suppTotal, mealsDone, mealsTotal, computedAt }`.
Decimals (`grams`, `weight`, `weightKg`) are numbers here (other legacy endpoints still return strings).

Errors: `400` bad date; `401 {code: "ACCOUNT_NOT_FOUND"}` when the token is valid but the
account no longer exists on the server (see §5).

## 4. Scores

- Computed by the server whenever relevant data for a date changes (toggles, sets/sessions,
  daily log `bw`/`day` (+13 following days), meal/supplement/block catalog, prefs) and on
  every `/today`. Formula = `contracts/README.md` (matches `contracts/score-vectors.json`).
- Inputs: protein/kcal = Σ eaten meals' tags × grams/100 (same as the app);
  targets = `proteinTargetG` (else lower bound of the text `proteinTarget`),
  `calorieTargetKcal`, `goalRateKgPerWeek`; bw slope = OLS of the last 14 weigh-ins ≤ date,
  needs ≥ 3 spanning ≥ 7 days.
- Planned train/rest: (1) selected program has `weekdays` → train iff a day lists the ISO
  weekday; (2) else `DailyLog.day == "Rest"` → rest; (3) else a WorkoutSession that date →
  train (planned sets from the day whose name = `programDayName`); (4) else non-empty
  `DailyLog.day` → train; (5) else rest. The selected program day is not used (not date-bound).
- `routinePct` = old tick ratio (blocks + supplements + that weekday's meals ticked ÷ total);
  legacy `score` column = `routinePct ?? 0`.
- Streak: consecutive kept days through yesterday (+ today if kept); 1 grace per ISO week
  for a scored non-kept day; unscored days break; today not kept → `pending` with yesterday's count.
- `GET /scores?days=N` (1–365) — v1 array of rows (now with outcome fields).
  `GET /scores?v=2&days=N` → `{ today, todayScore, streak, days: [Score] }`.

## 5. Data epoch and rehydrate (Render free DB may be recreated)

- `User.dataEpoch` is a random UUID created with the account (DB default). It is returned
  by `/today` and export v2. It never changes for the life of that server-side account.
- Client stores `{ epoch, counts }` from the last good `/today`. On every `/today`:
  - same epoch → normal;
  - **different epoch**, or `401 ACCOUNT_NOT_FOUND`, or `/auth/refresh` / login says the
    account doesn't exist → the server lost data.
- Rehydrate protocol: (1) if the account is gone, `POST /auth/register` with the same email
  (password from the user); (2) `POST /api/sync/import?v=2` with the device's full local
  backup (the last export v2 merged with local changes); (3) re-read `/today`, store the
  new epoch. Import keeps all ids, so the device's caches and queued writes stay valid; queued
  writes can then be flushed.

## 6. Backup v2

- `GET /api/sync/export?v=2` → `{ version: 2, exportedAt, dataEpoch, user, preferences, refs:{foods:[{id,name,brand}], selectedProgram}, scheduleBlocks, supplements, mealTemplates, mealTemplateTags, programs, programDays, programExercises, workoutSessions, workoutSetLogs, completions, supplementLogs, mealLogs, dailyLogs, userFoods, dailyScores }`.
  Rows carry ids, timestamps (ISO), `hlc`/`fieldClock`; `userId` omitted. Sorted by id.
- `POST /api/sync/import?v=2` (same shape, body ≤ 10 MB) → upsert by id, never re-IDs.
  Counterpart = same id, else same natural key (block+date, supplement+date, meal+date,
  session+exercise+set, log date, food, score date). Merge: toggles/sets → greater hlc wins
  (server row without hlc loses to the import); daily logs → per field by `fieldClock`;
  everything else → import wins. Idempotent (re-import = no changes).
  Response: `{ created, updated, unchanged, replaced, skipped, remapped }` per table.
  Rows pointing at parents you don't own are skipped; ids owned by another account → `409`.
  Reference foods / system programs are re-linked by name when their ids differ (re-seeded DB).
- `GET /sync/export` (v1) now includes meal `grams`/`foodId`; `POST /sync/import` (v1) keeps
  the posted ids when they are free (so another device's ids stay valid).
