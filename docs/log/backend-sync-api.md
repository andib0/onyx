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
| `POST /workouts/sessions/:id/sets` | `id?`, `hlc?` | upsert per (session, exercise, setNumber); values replaced only by a newer `hlc`; `410` if the session or the set `id` was deleted |
| `PATCH /workouts/sessions/:id/finish` | `endedAt?` (ISO), `markedDone?: boolean` | idempotent; keeps the first `endedAt` unless one is sent; `markedDone: true` ("Mark done", trained but didn't log) is sticky and counts as the planned sets (§4); `410` if the session was deleted |
| `DELETE /workouts/sessions/:id` (**new**) | `hlc?` | deletes the session and its sets, tombstones all of them (§2.3) |
| `POST /schedule`, `/supplements`, `/meals/templates`, `/programs` | `hlc?` | the create stamps every field it sets in `fieldClock` (§2.2); `410` if the `id` (or a program day/exercise id) was deleted |
| `PUT /schedule/:id`, `/supplements/:id`, `/meals/templates/:id`, `/programs/:id` | `hlc?` | **per-field last-writer-wins** (§2.2). Response row + `fieldClock`, `applied` (all sent fields applied), `appliedFields`, `staleFields`. `404` missing, `410` deleted |
| every `DELETE` of a deletable entity | body `{ hlc? }` | records a tombstone (§2.3) |
| `PATCH /logs/:date` (**new**) | any of `day,bw,sleep,steps,top,notes` + `hlc?`, `id?` | field-level: absent fields untouched; `""` clears. With `hlc`, each field applies only if newer than that field's clock. Response: row + `fieldClock`, `appliedFields`, `staleFields`. `201` if the row was created, else `200`. |
| `POST /logs` | same fields + `date`, `hlc?`, `id?` | now the same field-level semantics (absent fields are no longer overwritten with `""`). Returns `201` + row. |
| `PUT /preferences` | `proteinTargetG?`, `calorieTargetKcal?`, `goalRateKgPerWeek?` (numbers or null) | targets for the Outcome Score |
| `POST /programs`, `PUT /programs/:id` | `days[].weekdays?: number[]` (ISO 1=Mon … 7=Sun) | planned training days |
| `PUT /auth/profile`, `POST /auth/register` | `heightCm?` (100–250), `sex?` (`male`/`female`) | returned by `/auth/me` and `/today` |
| `POST /scores` | unchanged (still validated) | **ignored** except `date`: triggers a server recompute and returns the server row. Client values can no longer overwrite anything. Plan to stop calling it. |

### 2.2 Entity edits: per-field HLC last-writer-wins

`ScheduleBlock`, `Supplement`, `MealTemplate` and `GymProgram` carry `fieldClock`
(`{field: hlc}`), like `DailyLog`. Clocked fields: blocks `start end title purpose good tag
readonly source sortOrder`; supplements `item goal dose tier rule timeAt sortOrder`; meal
templates `dayOfWeek name examples grams foodId sortOrder tags` (tags = one field, replaced
as a whole); programs `name description goal days` (days = the whole day/exercise tree).

- A create with `hlc` stamps every field it sets (defaults included). A PUT with `hlc`
  applies each sent field only if `hlc` is strictly newer than that field's stamp (row lock,
  plain string comparison); stale fields are left alone and listed in `staleFields`.
  Concurrent edits from two devices therefore converge to the max-HLC value per field,
  whatever the arrival order.
- A PUT **without** `hlc` (legacy client) always applies and leaves the clock untouched.
- `PATCH /meals/templates/:id/grams` stays legacy (unclocked).
- Clients must stamp each field with the HLC of the edit that set it: the app's outbox keeps
  one stamp per field when it coalesces partial edits and sends one PUT per distinct stamp
  (programs are whole documents: one PUT, one stamp).

### 2.3 Delete tombstones (delete wins)

Deleting a user-owned row records `Tombstone {entity, entityId, hlc, deletedAt}` in the same
transaction: `block`, `supplement`, `meal` (template, incl. one-off foods), `program`
(+ `programDay`, `programExercise` of it), `session` (+ every `set` of it), `set`, `userFood`.
The DELETE body may carry `{hlc}` (else the server stamps `<now>-0000-server`).

- Ids are never reused, so a delete is final: any later write that names a tombstoned id —
  a create replay, PUT, toggle (`/schedule/completions`, `/supplements/:id/log`,
  `/meals/:id/log`), set POST, session finish, one-off food — answers
  **`410 {success:false, error:"Record was deleted"}`** and changes nothing. (Chosen over
  `200 {deleted:true}` so an old client never mistakes it for a stored row.) An id that never
  existed is still `404`; a repeated DELETE is `404` (nothing left to delete).
- Saving the same food again, or re-doing a set with the same number, uses a **new** id.
- Only the owner's delete records a tombstone (a foreign id is `404`, nothing recorded).
- `/today` and export v2 never list a tombstoned row (it is deleted and cannot come back).
- Not tombstoned: daily logs (`DELETE /logs/:id`; they are date-keyed and field-LWW — a later
  field write with a newer `hlc` re-creates that date's row), toggles (they are values).

Client rule: `410` → drop the op (the entity is gone; do not dead-letter it).

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
Workout sessions carry `markedDone: boolean`.
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
- **Mark done**: a session finished with `markedDone: true`, or a finished session with no
  sets at all (clients before the flag), makes T = 1 on a train day — it counts as the planned
  sets, whatever was logged and even without planned sets (contract input `markedDone`,
  `contracts/README.md`, vectors 15–18).
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

- `GET /api/sync/export?v=2` → `{ version: 2, exportedAt, dataEpoch, user, preferences, refs:{foods:[{id,name,brand}], selectedProgram}, scheduleBlocks, supplements, mealTemplates, mealTemplateTags, programs, programDays, programExercises, workoutSessions, workoutSetLogs, completions, supplementLogs, mealLogs, dailyLogs, userFoods, dailyScores, tombstones:[{entity,entityId,hlc,deletedAt}] }`.
  Rows carry ids, timestamps (ISO), `hlc`/`fieldClock`; `userId` omitted. Sorted by id
  (tombstones by entityId).
- `POST /api/sync/import?v=2` (same shape, body ≤ 10 MB) → upsert by id, never re-IDs.
  Counterpart = same id, else same natural key (block+date, supplement+date, meal+date,
  session+exercise+set, log date, food, score date). Merge: toggles/sets → greater hlc wins
  (server row without hlc loses to the import); daily logs, blocks, supplements, meal
  templates, programs → per field by `fieldClock` (a field without a server stamp loses);
  a template's tags / a program's days+exercises follow the parent's `tags` / `days` stamp
  (the losing side's children are dropped, never mixed); everything else → import wins.
  **Tombstones are applied first** (union with the stored ones): rows with a tombstoned id are
  skipped and an existing live row with such an id is deleted — so a rehydrate or an older
  backup from another device never resurrects a deleted row. Idempotent (re-import = no changes).
  Response: `{ created, updated, unchanged, replaced, skipped, deleted, remapped }` per table
  (`created.tombstones` / `unchanged.tombstones` too).
  Rows pointing at parents you don't own are skipped; ids owned by another account → `409`.
  Reference foods / system programs are re-linked by name when their ids differ (re-seeded DB).
- `GET /sync/export` (v1) now includes meal `grams`/`foodId`; `POST /sync/import` (v1) keeps
  the posted ids when they are free (so another device's ids stay valid).
