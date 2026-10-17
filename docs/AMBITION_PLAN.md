# Onyx Ambition Plan

Status: **DRAFT — waiting for owner approval** (2026-10-17)
Evidence: `docs/audit/01…07-*.md` (each claim there cites file:line, a command, or a measured request).
Baseline commit: `47df93e` (+ infra commit `d6831b9`).

> Outcome being optimised: *open Onyx → within 10 s know what to do today; logging is near-zero
> effort; never loses data, works offline, never crashes; measurably more consistent training and
> closer-to-target eating; stays healthy without the owner.*

---

## 0. Two things you need to know first

1. **Production looks down.** `https://onyx-api-wmis.onrender.com/api/health` did not answer in
   4 attempts (90 s, 30 s, 180 s, 180 s timeouts — see §1 note). DNS and Render's edge respond.
   Most likely cause: the **Render free Postgres expired** (free DBs expire ~30 days after creation;
   last deploy activity 2026-07-04), so `connectDatabase()` calls `process.exit(1)` at boot
   (`backend/src/config/database.ts:9-15`) and the service crash-loops. I cannot see the Render
   dashboard. **If your history lived there, it may already be gone**, and `/sync/export` never
   included workouts, sets, scores, saved foods or custom programs anyway (`sync.service.ts:276-288`).
   → Decision needed from you: hosting for the DB (see Bet 13). Everything else below proceeds
   without it.
2. **The brief's premises were partly stale** — there *are* tests (63 passing, 0 tsc/eslint
   errors) but they cover 7/17 mobile utils, 0/14 backend services, 0/59 routes. AGENTS.md is wrong
   on 25 checked claims (`01-architecture-and-docs.md` §2), including the AsyncStorage day cache it
   describes: **it no longer exists** — the key is never written, state lives only in memory.

---

## 1. Baseline vs targets

| Target | Baseline (measured unless marked *est.*) | Source |
|---|---|---|
| Cold start → interactive Focus < 1.0 s (mid Android, release) | **Emulator release APK: ≈ 2.3–3.9 s** to "Day score" visible, logged in, *warm local* API (5 runs, §7). First native frame alone 352–539 ms. **Offline + logged in → Login screen (reproduced on device).** A cold Render instance adds its wake time (*est.* 30–60 s). Critical path: fonts → 2 serial SecureStore reads → `/auth/refresh` (bcrypt) → `/auth/me` → `/sync/export` (all-time history). | §7, 07 §2, 02 §4 |
| Log meal/set/supplement ≤ 2 taps, ≤ 5 s | **4 of 11** core actions pass. Workout done ≈16 taps, ad-hoc food 5–6 + typing, barcode 5–6, all AM supplements 3, weight/sleep 4 + typing via Settings → History. | 06 §1 |
| 100% writes offline, deterministic, zero loss (kill, reinstall, 2 devices) | **3 of ~25 write types** queued (completion/meal/supplement toggles). Queue drops on any 4xx/429, replays stale toggles over newer ones (verified), not cleared on logout (cross-account replay verified). Workout sets silently lost if session start fails. Daily log upsert wipes other device's fields (verified). Score: last device wins, stale zeros overwrite (verified). Creates not idempotent: retry → duplicates (verified, 5/5 onboarding races doubled data). | 02 §1-3,7-8 |
| 0 tsc / 0 eslint, both packages | **Met** (0/0/0/0). Prettier `--check` fails on 69 backend + 57 mobile files. Lockfiles out of sync (`npm ci` fails). | baseline run, 01 |
| Unit tests every mobile util; every backend service | mobile utils **7/17** files; backend services **0/14** | file count |
| API tests every route | **2/59** (health, auth — added in d6831b9) | backend/test |
| E2E for 5 core flows | **1/5** (login→Focus smoke on Expo web, added in d6831b9) | e2e/ |
| "Today" = 1 round trip, p95 < 150 ms local | **7 requests** on critical path (refresh → me → 5 parallel). Startup wall p50 / p95: **149 / 267 ms** (my rerun, `npm run perf:bench`, 50 runs) and 173.5 ms p95 (audit run). `/auth/refresh` alone p50 135 ms (bcrypt). `/sync/export` payload grows unbounded (46 KB @ 60 days). | 02 §10, `backend/scripts/perf` |
| WCAG AA both palettes | **69 / 160** token pairs fail; 41 below 3:1. Light palette effectively unreachable at first launch (`app.json userInterfaceStyle: "dark"`). | 06 §5 |
| Touch targets ≥ 44 pt | ≥ 60 controls below: 23 `Button size="sm"` (36 pt) incl. workout Pause/End, chips 32, gram presets 28, tier chips ≈25. | 06 §5 |
| Labels on icon-only buttons | 0 unlabeled icon-only; 7 glyph/backdrop controls unlabeled (Stepper ±, Checkbox, My Foods ×, backdrops); 35 text touchables lack role. | 06 §5 |
| Bundle | Hermes 3.46 MB; JS 3.71 MB (908 KB gz); **8.24 MB assets of which ~8.2 MB unused** (34 font files + 19 icon fonts via barrel imports). | 07 §1 |

### 1a. Device measurement status
Android emulator (release APK, Maestro) works; results in §7. Web dev build (not comparable):
sign-in → Focus visible **1249 ms** (Playwright, `e2e/tests/smoke.spec.ts`).

---

## 2. Verdicts on the core assumptions

| Assumption | Verdict | Evidence |
|---|---|---|
| DailyScore measures a good day | **False.** score = ticked ÷ all blocks, equal weights. A finished workout is 6.7% of max; supplements 26.7%; meals double-counted; protein grams never read. 86.7% of max reachable without training; 100% regardless of eating. In simulation 39–44% of ≥80 days were bad days; correlation with true day quality 0.27–0.33. | 04 §A |
| Five tabs is the right structure | **False for the frequent actions.** 7/11 frequent actions exceed 2 taps; Schedule and Settings tabs host daily-input actions (weight, sleep) behind 4 taps. A 4-tab layout + quick-log brings all to ≤2 (food search still needs typing). | 06 §1 |
| Offline sync is safe | **False.** See §1 row 3 — 12 concrete break cases reproduced against the real API. | 02 |
| Client cache and server agree | **False.** 9 divergence paths: no refetch on foreground/reconnect, flush never invalidates, import re-IDs rows so other device's queued toggles 400 and drop, export omits meal `grams/foodId` (macros change after reload), UTC (server) vs local (client) day keys, score computed client-side. | 02 §3,6,8,11 |
| No-spread lint rule earns its keep | **Drop it.** Inherited from the removed Vite web config (`2fb69b9`); Hermes/Babel support spread; deps already ship it. It forces `delete`-with-casts and 12 `.concat([x])` workarounds; 73 `Object.assign` calls exist only to satisfy it. | 01 §5 |
| Refresh-token rotation protects sessions | **False (security High).** bcrypt reads first 72 bytes; all of a user's JWT refresh tokens share them → any token matches any hash. Rotated, logged-out tokens keep working 7 days (verified). Now pinned by `it.fails` tests. | 03 F1 |
| Nutrition targets reflect the goal | **False.** Calories = 33 kcal/kg for every goal (`utils/nutrition.ts:116`); "Apply adaptive protein" is a no-op when weight is set (`nutrition.ts:97-108`); adaptive target follows under-eating down to 1.19 g/kg with no floor. | 05 §6 |
| The program moves you through the week | **False.** Day never advances after a workout; no rest days; no stall/deload; PRs vs last session only (false PRs after any light day). | 05 §1-5 |

### 2a. "Something you don't know" — earliest predictor of a missed session
On simulated data (16 users × 2 years × 3 seeds, generator grounded in 7 cited behavioural
mechanisms, trained on year 1, tested on held-out year 2): the earliest robust signal is a
**3-day drop in logging volume** (meals/protein logged, AM supplement ticks) — lifts precision on
the top-10% risk days from ~49% to 55–61% at 1–3 days lead, gone by day 5. Day-of-week alone is
AUC 0.51; full model 0.63–0.67; oracle ceiling 0.71–0.75. **Caveat:** partly built into the
generator; this validates the *method*, not the finding. Two real-world insights that hold
regardless: (1) last night's sleep is only entered at the evening check-in, so it can never
predict that day's session; (2) ~15% of "misses" are likely done-but-unlogged sessions. Rerun
recipe on real data: `04-score-and-prediction.md` §B6 — blocked today by the prod DB state (§0).

---

## 3. Findings ranked by impact on the outcome

1. **Data can be lost today** — prod DB likely expired; export misses 5 tables; workout sets dropped on failed session start; daily log cross-device overwrite; stale toggle replay; logout doesn't clear queue. *(02, 01)*
2. **Cold start needs the network** — no persisted state, refresh-before-render, no timeout → 30–60 s spinner on cold Render, Login screen offline. *(02, 07, 06)*
3. **The score rewards busywork** — the feedback loop the app runs on optimises the wrong thing. *(04)*
4. **Targets are wrong** — calories ignore goal; protein Apply no-op; no floor. *(05)*
5. **Training logic stalls** — no day advance, no rest days, no deload, false PRs. *(05)*
6. **Logging friction** — 7/11 frequent actions > 2 taps; food add creates a recurring template, not a log. *(06)*
7. **Security** — refresh rotation broken (High), cross-user toggle ownership (High, code-only), raw body to Prisma on `/preferences`, env validation never imported, stack traces in dev errors. *(03)*
8. **Schema drift** — migrations can't rebuild schema; prod uses `db push` at boot. *(01)*
9. **Focus fails the 10-second test** — 12–15 competing numbers, review above action, workout below the fold. *(06)*
10. **Behavioural mechanics backfire** — streak shows 0 the morning after one miss; static notifications fire after the task is done; 3 simultaneous 08:00 banners; no implementation intentions. *(06, 04)*
11. **Accessibility** — 69 contrast failures; ≥60 sub-44pt targets. *(06)*
12. **Bundle/render waste** — 8 MB unused assets; 13 components re-render per event; 26 renders/s during a workout. *(07)*
13. **Docs/machinery rot** — AGENTS.md 25 stale claims; lockfiles; prettier. *(01)*

---

## 4. Bets

Format per bet: **Action · Expected effect · Verified by (not me) · Risk · Size (S ≤ ½ day, M ≈ 1–2 days, L ≈ 3–5 days of agent work)**,
then the *deeper-version check* that revised it.

### Bet 1 — REWRITE the data layer to local-first (cache, session, `/today`) — L
- **Action:** (a) Persist the TanStack Query cache to AsyncStorage (`PersistQueryClientProvider`, versioned buster). (b) Restore session from stored tokens + cached user with **zero network**; refresh lazily on first 401 or when the access token is near expiry. (c) New `GET /api/today?date=YYYY-MM-DD&tz=…` returning exactly what Focus needs (blocks + completions, meals + logs with grams, supplements + logs, today's program day, active session, last 30 days of scores, prefs) — one round trip; `/sync/export` leaves the startup path. (d) 8 s `AbortController` timeout on every request; background refetch on foreground/reconnect (`focusManager`/`onlineManager`). (e) Hold the native splash until cached Focus is renderable.
- **Effect:** Focus renders from disk on every launch, online or not; cold Render no longer visible; 7 → 1 requests; p95 dominated by one indexed query.
- **Verified by:** Playwright offline e2e (`context.setOffline(true)` before reload → Focus shows yesterday-cached data); API latency benchmark script (p95 over 200 runs on 1 year of seeded data, fails > 150 ms); Maestro cold-start flow + `adb am start -W` p50/p90 over 10 runs on the emulator (if the emulator works — §7).
- **Risk:** stale-cache bugs at midnight rollover → covered by a date-keyed query key + unit tests with a fake clock. Med.
- **Deeper check:** a pro would also *bound* the cache (prune > 60 days), and version the persisted schema so an app update can't crash on old shapes → included. Rawest material: the actual request waterfall (already captured in 02 §4). External judge: the Playwright offline run and the latency script, not my reading.

### Bet 2 — REWRITE writes as a durable, idempotent outbox with deterministic merge — L
- **Action:** every write (all ~25 types incl. workout sessions/sets, daily log fields, creates) goes through one persisted outbox: client-generated UUIDs for new rows, `Idempotency-Key` per op, ops coalesced per entity key (latest toggle wins locally before sending), never dropped on 4xx without surfacing (dead-letter list visible in Settings), cleared per account on logout. Server: creates become upserts by client id; updates carry a client hybrid-logical-clock timestamp; per-field last-writer-wins by HLC (not by arrival); daily log becomes PATCH (field-level). DailyScore is **computed on the server** from the data, never posted by the client.
- **Effect:** 100% of writes work offline; kill/reinstall loses nothing that reached the outbox; two devices converge to the same state regardless of delivery order.
- **Verified by:** (1) a **property-based convergence test** (fast-check): N random ops across 2 simulated devices, random network drops/duplicates/reorders/clock skew ±10 min, assert both devices + server end in identical state equal to a reference model — the classic CRDT/LWW test from distributed-systems practice; (2) API tests replaying every op twice (idempotency) for every write route; (3) the 12 break cases from audit 02 turned into regression tests; (4) Playwright: log while offline → reload → back online → server state matches.
- **Risk:** biggest change in the plan; mitigated by landing server idempotency first (backward compatible), then client outbox type-by-type. High.
- **Deeper check:** a distributed-systems engineer would reach for HLC rather than wall clock (clock skew is in your brief) and for a reference-model property test rather than hand-picked cases → adopted. Considered SQLite (expo-sqlite) as the local store; rejected for now: the persisted query cache + outbox gives the guarantees with far less rewrite; revisit if cache > ~2 MB.

### Bet 3 — FIX auth & ownership (security) — M
- **Action:** refresh tokens get a random `jti`; store `sha256(token)` (unique index), O(1) lookup, real rotation with reuse detection (reuse ⇒ revoke family); logout revokes only that device's family; pin `algorithms: ['HS256']` and add a `typ` claim; import and enforce `config/env.ts`; dedicated limiter on `/auth/refresh`; per-route body limits (10 MB only on `/sync/import`); ownership checks on toggle/completion/tag routes; Zod on every route (preferences, scores, user-foods, profile, query params); dev error handler stops leaking stacks; malformed JSON → 400.
- **Effect:** stolen/rotated tokens die; no cross-user writes; startup refresh drops from ~135 ms to <5 ms (no bcrypt).
- **Verified by:** the two `it.fails` tests flip to passing; a generated **IDOR matrix test** (user B hits every `:id` route with user A's ids → all 404); a route-coverage test that fails if any router lacks a Zod `validate` (walks the Express stack); `npm audit --omit=dev` ≤ 0 high in backend.
- **Risk:** existing sessions get logged out once at deploy (acceptable, single user). Low.
- **Deeper check:** a security pro would add the *automated* route/validator/ownership coverage so a future route can't regress silently → that's the matrix + stack-walk test.

### Bet 4 — FIX schema, migrations, backups — M
- **Action:** create a baseline migration that matches `schema.prisma` (verified with `prisma migrate diff` = empty); switch Render start to `prisma migrate deploy`; `/sync/export` v2 includes every user table (workouts, sets, scores, user foods, programs, prefs) with timestamps; scheduled weekly encrypted export (GitHub Action → artifact) once the DB question is settled.
- **Effect:** schema reproducible from git; full backups restorable.
- **Verified by:** CI job: fresh Postgres → `migrate deploy` → `migrate diff` empty; round-trip test: seed 1 year → export → wipe → import → deep-equal on every table.
- **Risk:** the first `migrate deploy` against an existing `db push` DB needs `migrate resolve --applied` for the baseline — scripted and documented. Med.

### Bet 5 — REWRITE the score around outcomes — M
- **Action:** Outcome Score = 100 × (0.40 training-vs-plan + 0.30 protein adherence + 0.20 calorie adherence + 0.10 weekly bodyweight-trend-vs-goal); planned rest day = full training credit; checklist items (supplements, schedule) shown as a separate "routine" ring, not in the score. "Kept day" = training per plan done AND protein ≥ 85% of target. Streak = consecutive kept days with one grace day per **calendar week**, never displayed as 0 before the day ends ("1 day to repair"). Server computes and stores; history fetched from `DailyScore` for 365 days.
- **Effect:** the number you look at every day moves only when the things that change your body move.
- **Verified by:** unit tests encoding the audit's counter-examples (skipped session + 50% protein must score < 60; perfect rest day must score 100); the simulation harness (`docs/audit/scripts/score_audit.py`) re-run against the new formula must show correlation with true day quality ≥ 0.50 (current 0.27–0.33); after 8 weeks of real use, the rerun recipe on real data.
- **Risk:** you may miss the satisfying "tick everything" feel → routine ring keeps it, just separated. Low.
- **Deeper check:** a behavioural scientist would warn the streak *display* matters as much as the formula (what-the-hell effect, Silverman & Barasch 2023 on repairable streaks) → "repair" state added.

### Bet 6 — FIX training logic against established methods — M
- **Action:** program cursor advances on workout completion; explicit rest days from program frequency; double progression kept, plus stall rule (3 sessions without rep gain ⇒ 10% deload, 5×5 per Starting Strength/Texas convention); PR = vs all-time best e1RM (Epley, capped ≤10 reps, Brzycki cross-check), one PR per exercise per session; equipment-aware increments/plate math from the library's `equipment` field (no plate math for DB/cable/machine); RIR stored as *reported*; exercise name canonicalisation (alias table, migrates 35 unmatched names); fix under-dosed seed programs to ≥10 sets/muscle/week (Schoenfeld 2017).
- **Verified by:** scenario-table unit tests where the expected values come from the published methods (stall at 8/7/6 ×3 ⇒ deload weight = 0.9×; 30 kg DB bench ⇒ no plate math); a weekly sets-per-muscle test over every seeded program (fails < 10 for any major muscle in non-beginner programs).
- **Risk:** Low. **Deeper check:** a coach would autoregulate from reported RIR, not fixed increments → RIR capture is a prerequisite; RPE-based load suggestion is a follow-up bet only if you log RIR consistently (data will show).

### Bet 7 — FIX nutrition targets and food logging — M
- **Action:** calories = Mifflin-St Jeor BMR × activity factor ± goal delta (cut −20%, bulk +10%, recomp 0) and, after 14 days of weigh-ins + intake, an adaptive TDEE (energy-balance back-calculation from the 7-day weight trend, the MacroFactor/Hall-model approach); protein 1.6–2.2 g/kg by goal with a hard floor of 1.6 g/kg; "Apply" actually overrides; targets use the trend weight, not the static profile weight. Barcode: per-serving default when OFF provides `serving_quantity`, kJ→kcal conversion, 6 s timeout, offline queue of the scan, manual-entry fallback prefilled with the barcode. Ad-hoc food add creates a **one-off log**, not a recurring template.
- **Verified by:** unit tests whose oracles are hand-computed from the published equations (80 kg, 180 cm, 30 y male, cut ⇒ BMR 1780, etc.); recorded Open Food Facts fixtures (≥ 10 real products incl. kJ-only and missing-serving cases).
- **Risk:** Low. **Deeper check:** a dietitian starts from *your* intake/weight data, not formulas → adaptive TDEE is the core, formulas only bootstrap.

### Bet 8 — REWRITE navigation: Today-first, 4 tabs + quick-log — L
- **Action:** tabs **Today · Train · Eat · Progress** (Schedule folds into Today; Settings behind avatar). Today shows, in order: the one next action (time-ordered, from the plan), today's workout card with Start/Resume, protein/calorie bars, routine ring; review content (recap, insights) below the fold. Global **+** opens a quick-log sheet: last-5 foods, "Log planned meal", "Take all AM supplements" (bulk), weight, sleep — each 1 tap after the sheet. Workout: "Finish" = 1 tap with undo; End needs hold-to-confirm. Morning card asks sleep + weight (so sleep can predict *that* day — §2a).
- **Effect:** all 11 core actions ≤ 2 taps (food search still needs typing); one clear next action above the fold.
- **Verified by:** Playwright flows per action that **count taps and wall-time** and assert ≤ 2 taps / ≤ 5 s (machine-measured on web; Maestro equivalents on Android if available); screenshot diff per screen; a "first viewport" test asserting the next-action card and workout card are within the first 915 px.
- **Risk:** biggest UX change; muscle memory resets. Med.
- **Deeper check:** an interaction designer would measure, not count by reading → the Playwright tap/time harness is built *before* the redesign so baseline and after come from the same instrument.

### Bet 9 — FIX behavioural mechanics — M
- **Action:** implementation-intention step in onboarding ("I will train on [days] at [time] at [place]") that sets the schedule and notification; notifications cancelled when the item is done, supplements consolidated into one banner per time slot, check-in card and notification aligned; streak repair state (Bet 5); early-warning nudge when the 3-day logging-drop signal fires (§2a) — *only* after the real-data rerun confirms it, otherwise off.
- **Verified by:** unit tests on the scheduling logic with a fake clock (no notification for completed items; one per slot); the real-data rerun (AUC on held-out weeks) gates the nudge.
- **Risk:** Low. Notification delivery itself can only be checked on a device.

### Bet 10 — FIX accessibility to AA — M
- **Action:** retune `theme.ts` tokens until every text/UI pair passes (4.5 / 3.0) in both palettes; checkbox outline and on-colour check marks fixed; primitives enforce `minHeight: 44` (sm buttons get hitSlop to 44); labels + roles on the 7 glyph controls and 35 text touchables; respect reduced motion; remove `userInterfaceStyle: "dark"` lock (or keep dark but stop shipping an unreachable light palette — your call; default: follow OS).
- **Verified by:** a **contrast unit test** that computes WCAG ratios for every declared pair in both palettes (fails < AA); an ESLint/AST test that fails on any `Pressable`/`TouchableOpacity` without `accessibilityRole`, or icon-only without `accessibilityLabel`; Playwright axe-core scan of each screen on web.
- **Risk:** visual identity shifts slightly. Low.

### Bet 11 — FIX performance waste — S/M
- **Action:** direct-path icon imports (`@expo/vector-icons/Ionicons`) and only the 4 used font files; memoise context values; split workout timer into its own context (26 → ~1 renders/s); split toast state from `showToast`; remove the redundant `PUT /preferences` on every launch.
- **Verified by:** bundle budget script (`scripts/check-bundle-budget.mjs`, fails if Hermes > budget or assets > 1 MB); render-count test harness asserting ≤ N renders per event; cold-start measurement (Bet 1).
- **Risk:** Low.

### Bet 12 — DELETE — S
- **Delete:** `TimelineSummary.tsx`, `utils/formatting.ts`, ~18 unused API wrappers, unused helpers (verified unused by grep + tsc after removal); the no-spread lint rule (and, opportunistically, the `delete`-with-cast workarounds it forced); `future.ignore.md` (obsolete Rust plan) and the 8 planning docs → `docs/archive/` with a one-line status header each; `.claude/settings.local.json` from git tracking.
- **Verified by:** tsc/eslint/tests green after each deletion.
- **Keep:** Express + Prisma + Postgres (adequate; a rewrite buys nothing for one user), TanStack Query, Expo Router, the food DB (95% USDA match), double progression, theme tokens/primitives.

### Bet 13 — Hosting decision (needs you) — S
- **Options:** (a) Render paid Postgres (~$7/mo; no expiry, daily backups); (b) Neon free tier (no 30-day expiry, branching for test DBs; API stays on Render free); (c) keep Render free and accept 30-day rebuilds (not compatible with "never loses data").
- **Recommendation:** (b) Neon free + Render free API + local-first client (Bet 1) makes the API's cold start invisible. I can't create accounts or enter payment details; you would create the DB and paste the connection string into Render's env yourself.

### Bet 14 — Machinery (Step 5) — M
- `npm run check` in each package: tsc + eslint + prettier --check + unit + API tests (backend) / e2e smoke (mobile, via e2e/).
- **GitHub Actions CI** with a Postgres service container: runs both `check`s, migration-diff check, bundle budget, API latency budget, Playwright smoke on the web build — the judge that is neither of us, on every push.
- Perf budgets that fail loudly: bundle size, `/today` p95, render counts, (cold start on emulator when available — local script, not CI).
- `docs/HEALTH_ROUTINE.md`: weekly checklist (run check, audit, dependency updates via `npx expo install --check`, backup restore drill, real-data prediction rerun monthly).
- `AGENTS.md` rewritten from the verified architecture map (01).

---

## 5. Execution order (slices, each green before the next)

1. Bet 12 (deletions, lint rule) + lockfile/prettier normalisation — clean baseline.
2. Bet 14 skeleton: `npm run check`, CI, tap/time harness, contrast test, bundle budget (judges first).
3. Bet 3 security + Bet 4 migrations/export v2 (server foundations, backward compatible).
4. Bet 2 server side (idempotent upserts, HLC, server-computed score) → Bet 1 (`/today`, persisted cache, offline session) → Bet 2 client outbox, type by type.
5. Bet 5 score + Bet 6 training + Bet 7 nutrition (pure-logic, test-first).
6. Bet 8 navigation/Today + Bet 9 behaviour.
7. Bet 10 a11y + Bet 11 perf.
8. AGENTS.md, HEALTH_ROUTINE.md, final measurements, report.

Every slice logs before/after numbers in `docs/AMBITION_LOG.md`.

## 6. What I need from you
1. **Approve / edit this plan.**
2. **Hosting (Bet 13):** a / b / c — and, if prod data matters, check the Render dashboard for the DB status.
3. **Spread rule:** OK to drop it (the brief lists it as a convention to follow)?
4. Light palette: follow OS (default) or dark-only?

## 7. Device measurement results (2026-10-17)

Setup (user-level, nothing in the repo): JDK 17 (Temurin), Android SDK 36 / NDK 27.1, AVD
`onyx_pixel` (pixel_6, API 35 x86_64, 4 GB, WHPX-accelerated on an i7-8700K host), Maestro 2.11.0.
Release APK built from a copy at `C:/Users/andi/onyx-build` (the scratch path exceeded Windows'
260-char limit for CMake), `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001/api`. Clean build ≈ 9 min,
incremental ≈ 1 min. Flows: `e2e/maestro/login.yaml`, `e2e/maestro/coldstart-focus.yaml`.

| Measurement | Result |
|---|---|
| `am start -W` TotalTime, logged out (first frame = Login) | 539, 352, 368, 353, 390 ms (avg 400) |
| Logged-in cold start → "Day score" visible (Maestro launch → assertion) | 3606, 3601, 3912, 3233, 3946 ms; minus Maestro's ~1.3 s launch command ⇒ **≈ 2.3–2.9 s** app time (bracket 2.3–3.9 s) |
| Logged-in cold start in airplane mode | **Login screen** (`docs/audit/evidence/android-offline-coldstart-logged-in.png`) |
| Release build against an `http://` API | "Network request failed": release manifests block cleartext, so local e2e builds need `usesCleartextTraffic` for the local API only (`android-release-cleartext-blocked.png`). Machinery fix in Bet 14: an `app.config.ts` that enables it only when `EXPO_PUBLIC_API_URL` starts with `http://10.0.2.2`. |

Caveats: an emulator on a desktop CPU is faster than a mid-range phone for native work and
slower for I/O; Maestro polls the UI, so its timestamps are upper bounds. Bet 1 adds JS perf
marks (`ONYX_PERF focus_interactive`) read by `npm run perf:tti`, which replaces this bracket with
a direct number.
