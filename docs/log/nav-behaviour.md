# Navigation + behaviour log — Bets 8 & 9 (2026-10-17)

Branch `worktree-agent-a6ec400c453beb0bc`, merged `main` @ `93de761` (contains `92b1524`)
before work. Judges per commit: `mobile/ npm run check` (tsc, eslint, prettier, vitest incl.
contrast + touchables, app config, bundle budget, e2e smoke), `backend/ npm run check` when
backend changed, and `e2e/ E2E_ENFORCE_BUDGETS=1 npx playwright test` at the end.
Local e2e used its own ports/DB (3501 / 8581 / `onyx_e2e_nav_test`) — another agent held 8481.

## Outcome: tap/time, before → after (same instrument, `e2e/lib/flow.ts`, Pixel 7 web)

Baseline = `docs/log/machinery.md` (old 5-tab UI). After = this branch,
`E2E_ENFORCE_BUDGETS=1` (soft asserts ≤ 2 taps / ≤ 5 s; text inputs reported, not taps).

| # | Action | Before: taps / inputs / screens / scrolls / time | After: taps / inputs / screens / scrolls / time | Path now |
|---|---|---|---|---|
| 1 | Log a set (active) | 1 / 0 / 0 / 0 / 0.19 s | **1** / 0 / 0 / 0 / 0.17 s | Today: active workout card → "Set N done" |
| 1b | First set of the day | 2 / 0 / 0 / 0 / 0.36 s | **2** / 0 / 0 / 0 / 0.41 s | next action "Start workout" → "Set 1 done" |
| 2 | Mark workout done | 15 (every set) / 0 / 0 / 0 / 3.5–5.2 s ✗ | **1** / 0 / 0 / 0 / 0.12 s | "Finish workout" (shown once ≥ 80 % sets logged) + undo bar |
| 3 | Planned meal | 1 / 0 / 0 / 0 / 0.23 s | **2** / 0 / 1 / 0 / 0.36 s | + → "Log planned meal: …" (or 1 tap when it is the next action / timeline row) |
| 4 | Ad-hoc food (search) | BLOCKED (B2), ≥ 3 + 1 input | **2** / 1 / 1 / 0 / 0.78 s | + → type → tap result (one-off entry) |
| 4b | Ad-hoc food (recent) | 5 (audit) | **2** / 0 / 1 / 0 / 0.63 s | + → tap recent |
| 5 | Barcode | n/a on web | n/a on web | (unchanged: Eat → Add to plan → Scan) |
| 6 | One supplement | 1 / 0 / 0 / 0 / 0.19 s | **1** / 0 / 0 / 0 / 0.26 s | next action "Mark taken" |
| 6b | All AM supplements (3) | 3 / 0 / 0 / 0 / 0.47 s ✗ | **1** / 0 / 0 / 0 / 0.18 s | next action "Take all 3" (also + → "Take all 08:00 supplements") |
| 7 | Tick a schedule block | BLOCKED (B3) | **1** tap (+1 scroll), still BLOCKED by B3 | Today timeline row (B3 lives in `hooks/useCompletion.ts`, data layer) |
| 8 | Bodyweight (morning) | 3 / 1 / 2 / 0 / 0.81 s ✗ | **1** / 0 / 0 / 0 / 0.23 s | Today morning card, prefilled with yesterday → "Log weight" |
| 9 | Sleep (morning) | 3 / 1 / 2 / 0 / 0.67 s ✗ | **1** / 0 / 0 / 0 / 0.21 s | same card → "Log sleep" |
| 10 | Evening check-in | 1 / 3 / 0 / 0 / 0.28 s | 1 / 3 / 0 / 0 / 0.35 s | card at 20:00 (= notification time); asks only what the morning didn't |
| 11 | What's next | 0 / 0 / 0 / 0 / 0.02 s | 0 / 0 / 0 / 0 / 0.02 s | next-action card in the first viewport |

Every feasible action is ≤ 2 taps and ≤ 5 s (machine time). Before: 7 of 11 measured rows
passed; after: 13 of 13 measurable rows pass except #7 (blocked by B3, 1 tap once fixed).
Food search still needs typing (1 input). "Mark workout done" assumes the sets were logged
during the session; a "trained but didn't log" shortcut needs a `markWorkoutDone()` in the
data layer (handed off below).

First-viewport tests (412×915): next-action card, workout card and protein bar bottoms are
≤ 915 px at 08:05 on a training Monday; on a planned rest day (Tuesday) the workout slot is a
"Rest day" card with "Train anyway", also above the fold.

## What changed

**Navigation (Bet 8).** Tabs Today · Train · Eat · Progress (`app/(tabs)/_layout.tsx`).
Schedule folds into Today's timeline (editor at `/schedule`, a stack screen); Settings is the
gear in Today's header (`/settings`); Program editor + training plan from Train; Insights,
Achievements, History from Progress. `/(tabs)/focus` stays as a hidden redirect to Today
(old deep links / notifications); login, index, not-found and onboarding land on Today.
`NotificationResponder` routes check-in/supplement taps to Today and training to Train, and
"Mark all taken" handles the per-slot `supplementIds`.

**Today** (`app/(tabs)/today.tsx`, `components/today/*`, adapter `hooks/ui/useTodayPlan.ts`):
1. the ONE next action — `utils/dayPlan.ts` builds one time-ordered plan (workout, one item
   per supplement time slot, meals at their Nutrition slots or default times, plain blocks)
   and picks: active workout → open item whose window started (priority workout >
   supplements > meal > block) → missed meals/supplements/workout stay actionable today,
   missed blocks drop after their window → else the earliest upcoming. Fixes the audit's
   "nextBlock ignores time order / hidden while a block is active".
2. today's workout (compact Start) or a clear rest-day card with "Train anyway";
3. protein + calorie bars vs targets (incl. one-off foods);
4. Day (outcome) ring + streak: a 0/missing score before day end reads "–" ("in progress");
   the streak is never shown as 0 while today can keep it: "N-day streak · keep it today",
   or "· 1 day to repair — keep today" when the weekly grace covered yesterday;
5. morning card until 11:00 (weight + sleep, prefilled, 1 tap each).
Below the fold: evening check-in, the full timeline with inline checkboxes, getting-started,
weekly recap, yesterday recap, insights teaser. Check-in and getting-started render
independently (audit 06 #4: getting-started can no longer hide the check-in).

**Quick log** (`hooks/ui/quickLog.tsx`, `components/quicklog/*`): "+" above the tab bar on
every tab. Rows: take the due supplement slot (bulk), log the next planned meal, food search
with the last 5 recents (one tap = logged), weight and sleep steppers prefilled. Actions close
the sheet and show an undo bar (`hooks/ui/undo.tsx`, `components/shared/UndoBar.tsx`).

**One-off foods (backend + adapter).** `POST /api/meals/one-off` (Zod `oneOffMealSchema`,
idempotent on client `id`): creates a template whose `dayOfWeek` is the ISO date (never
matches a weekday, so it does not recur) + an eaten `MealLog`, one request. `/today` includes
templates dated today. API tests: 201, 200 replay, never a weekday template, in `/today` and
counted, 400 (bad date, no name), 401 — route coverage 62/62. Client: `hooks/ui/useTodayMeals.ts`
(`logFood`, `removeFood` for undo, `toggleMeal`), `utils/normalize.ts` keeps date-keyed
templates. Ad-hoc food in Eat/quick-log is now a one-off; the old sheet in Eat is explicitly
"Add to plan".

**Eat**: today's intake first (macros of planned + one-off, today's list), the weekly plan below.
**Train**: today's session card at the top (Start / sets / Finish), the plan, "Edit plan".
**Progress**: streak, weight trend (goal pace from the program goal instead of the
hard-coded "Lean bulk pace"), adherence, protein 7 days, Insights/Achievements/History.

**Workout (Bet 8 §4).** "Finish workout" = 1 tap when ≥ 80 % of planned sets are logged
(`workoutCountsAsDone`, mobile-logic rule); the stop is deferred behind the undo bar, so Undo
just keeps the session. Below 80 % the only exit is "End early · n/m sets", a hold-to-confirm
(`components/shared/HoldButton.tsx`, 600 ms; a tap explains "Hold to confirm"). Pause moved
next to the clock (≥ 44 pt, secondary); finishing has its own row — no 36 pt danger button
beside Pause.

**B2 fixed** — root cause: the API serialises Prisma `Decimal` grams as a string; the web
`@react-native-community/slider` builds `new Animated.Value(value)` and throws on a
non-number. `MealCard` now coerces grams to a finite number. Reproduced with a Playwright
script (error gone after the fix).

Also fixed on the way: `FAB` (an animated Pressable with a style function lost its styles on
web, rendered in-flow and squeezed the tab bar); Stepper input `minWidth: 0` on web.

## Behaviour (Bet 9) — evidence in code comments

| Mechanic | Implementation | Evidence |
|---|---|---|
| Implementation intention | Onboarding step 3 "When and where will you train?" (days, time, place) → `utils/trainingIntention.ts`, saved on device (`hooks/ui/useTrainingIntention.ts`), training block moved to that time / created (`hooks/ui/applyIntention.ts`), training reminder enabled; editable at `/training-plan` | Gollwitzer & Sheeran 2006 (d = 0.65) |
| Training days | Today/Train/score read the intention's weekdays (rest card otherwise) | — |
| Notifications done-aware | `utils/reminderPlan.ts` plans today + 6 days of one-shots; nothing for taken slots, logged check-ins, finished workouts, or past times; `components/ReminderSync.tsx` re-plans on every change (debounced) and `syncPlannedReminders` diffs instead of churning | Nahum-Shani 2018 (JITAI) |
| One banner per supplement slot | grouped by exact time, "Mark all taken" action | Mehrotra 2016 (receptivity) |
| Check-in time | card and notification share `CHECK_IN_TIME = 20:00` (was 19 vs 20) | audit 06 §3 |
| Streak repair | "1 day to repair — keep today", never "0" before day end | Silverman & Barasch 2023 |
| Early-warning nudge | `FEATURE_FLAGS.earlyWarningNudge = false`, planner branch exists, test asserts it stays off | plan §2a (needs real-data rerun) |

Fake-clock unit tests (`utils/__tests__/reminderPlan.test.ts`): one banner per slot (3 → 1),
no notification for completed items, partial slots list only pending, nothing in the past,
check-in minute == card minute, training reminder on intention days at time − 15 min, 7-day
plan = one entry per slot per day, prefs off → nothing, nudge off. `sideEffects.test.ts`:
one-shot DATE triggers, diffing (same plan → 0 changes; taken slot → its banner cancelled),
legacy daily repeats removed. `dayPlan.test.ts`: plan order, next-action picking, intention maths.

## For the integrator (client-data owns these files)

- `contexts/AppStateContext.tsx` still calls `syncSupplementReminders` on supplement changes;
  it is now a shim that only removes legacy daily repeats — delete that effect;
  `components/ReminderSync.tsx` owns scheduling.
- `hooks/ui/useTodayMeals.ts` posts `/meals/one-off` directly with a client UUID and patches
  `appState` via `setAppState`; replace with an outbox mutation (it is idempotent on `id`).
  Data needed from the new layer: today's templates incl. date-keyed one-offs (or `/today`
  `meals.templates`, which already includes them).
- `useProgram().planFor()` derives training days from sessions/week; it should honour the
  intention's weekdays (`hooks/ui/useTrainingIntention.ts`, AsyncStorage
  `onyx_training_intention_v1`) or persist them as program `days[].weekdays` server-side, so
  past-day streak scoring agrees with Today.
- `useWorkout` needs `markWorkoutDone()` (done without logged sets, ~15 % of "misses",
  plan §2a) — UI slot is ready next to Finish.
- B3 (`hooks/useCompletion.ts` in-place mutation) blocks flow #7; test stays `test.fail`.
- B1 (refresh cookie on web) unchanged; e2e keeps its shim.

## Judges (final, on `main` @ 93de761 + this branch)

- `mobile/ npm run check`: tsc, eslint, prettier, vitest (incl. contrast + touchables a11y,
  render counts, new reminderPlan/dayPlan/uuid tests), app config, bundle budget
  (HBC 3,202,164 / 3,280,000 B; assets 883 KB / 930 KB), e2e smoke — **pass**.
- `backend/ npm run check` (TEST_DATABASE_URL local): tsc, eslint, prettier, unit, API
  (174 tests, route coverage 62/62 with 2xx + 4xx), migrations — **pass**.
- `e2e/ E2E_ENFORCE_BUDGETS=1 npx playwright test`: 20 passed, 2 skipped (screens, opt-in),
  3 expected failures (`test.fail`: #7 B3, the two offline tests owned by Bet 1).
- Environment notes: the shared machine ran out of memory twice (Metro / `expo export`
  OOM-killed) — reruns passed. Metro started with `CI=1` does not watch files; restart it after
  edits when reusing a server.

## Screens

`docs/log/screens/nav/{today,today-below,quicklog,train,eat,progress}-{light,dark}.png`
(Playwright, 412×915, reduced motion; regenerate with
`E2E_SCREENS=1 npx playwright test tests/screens.spec.ts`).
