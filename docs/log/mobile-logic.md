# Mobile logic log — Bets 5, 6, 7 (+ Bet 11 timer split)

Branch `worktree-agent-aab10d2cc3efa32b8`, fast-forwarded to `main` @ `3275a4e` (contracts) before work.
Judges run before every commit, in `mobile/`: `npx tsc --noEmit`, `npx eslint .`,
`npx prettier --check .`, `npx vitest run`; backend seed touched → in `backend/`:
`npx tsc --noEmit`, `npx eslint src/`, `npx vitest run` (all green at every commit).

| Commit | What |
|---|---|
| `f641a88` | Outcome Score + streak (contract), Focus ring shows "Day" score + secondary "Routine %" |
| `618cbf6` | Training engine: stall/deload, e1RM/PRs, equipment loading, name canonicalisation, program calendar, seed volume fix |
| `1f995d7` | Wiring: useWorkout/useProgram/WorkoutSection, timer split (leaf ticking), exercise detail |
| `64930b4` | Nutrition: MSJ + goal delta, protein floor + Apply override, trend weight, adaptive TDEE, Open Food Facts |
| `a0b6dbb` | Tests for the remaining utils (achievements, insights, normalize, haptics, storage, recentFoods, notifications) |

## Numbers

| Measure | Before | After |
|---|---|---|
| mobile/utils files with tests | 7 / 17 (plan baseline; 10 / 16 at `3275a4e`) | **24 / 24** (8 new util modules, all tested) |
| mobile tests | 78 (8 files) | **259 (23 files)** |
| Contract vectors matched (`contracts/score-vectors.json`) | — | **14 / 14** |
| Consumer re-renders of `useWorkout` over 10 s of an active workout (react-test-renderer harness, fake timers) | **20** (2/s → ×13 context consumers ≈ 26/s, audit 07) | **0** |
| Consumer re-renders across a full 90 s rest | ≈ 180 (2/s) | **1** (the auto-advance) |
| Seeded program names not in the exercise library | 35 / 42 (audit 05 #10) | **0** (programs use canonical names; library +10 exercises) |
| Non-beginner programs with a major muscle < 10 sets/week | 3 (Lean Bulk, Fat Loss, Recomp\*) | **0** |

\* Recomp was 14/muscle as intended, but its 4×/week frequency wasn't machine-readable (inferred 2×); the description now says "4x/week".

Render harness: `hooks/__renderharness__.test.tsx` mounted `useWorkout` with
`react-test-renderer@19.1.0` (installed `--no-save`, not committed — no lockfile change),
started a workout, advanced fake timers 20 × 500 ms and counted renders. Rest auto-advance and
the ≥ 80 % End rule were asserted in the same harness. Copy kept in the session scratchpad.

## Bet 5 — Outcome Score

`utils/outcomeScore.ts` reproduces `contracts/outcome_score_reference.py` (Python-truthiness of
`0` targets, `floor(x + 0.5)` rounding, 4-dp components). Selected vectors:

| Day | Old tick score (audit 04 A2) | Outcome score |
|---|---|---|
| Skipped session, ate 50 % protein | 87 (counted for streak) | **45**, not kept |
| Perfect planned rest day | 87–93, 100 impossible | **100**, kept |
| 12 / 15 sets (80 %) | — | 100 (T = 1) |
| Nothing eaten logged | 0 | **unscored** (ring shows "–") |

Streak (`computeStreak`): one grace per ISO week (Mon–Sun) instead of rolling-8; walks the
whole history (365+ days tested, no 30-row cap); today is never a break — "pending" shows
yesterday's count. Scenario: kept Mon/Tue, missed Wed → Thursday morning shows **2 · pending**
(old: 0). Interpretation: unscored days (nothing logged / no row) are not grace-eligible — logging
a bad day keeps the chain, not logging breaks it (contract says grace covers "non-kept,
non-unscored" days).

Focus wiring (minimal): ring = outcome score, label "Day", secondary line "Routine N% · x/y
done"; streak line adds "· keep it today" while pending. `postScore` still posts the routine %
(server will compute the outcome score authoritatively — backend-sync). Past days are scored
client-side from `DailyScore` snapshots (workoutDone, protein, calories) for the streak.

## Bet 6 — Training

| Scenario (audit 05 §1) | Before | After |
|---|---|---|
| Bench 6–10, 62.5 kg × 8/7/6 three sessions | "Repeat 62.5 · aim 9" forever | **"Stalled 3× at 62.5kg → deload 55kg × 6"** (0.9 × 62.5 = 56.25 → nearest 2.5, tie → lighter) |
| Bench 10/10/9 → 10/9/8 → 9/8/7 at 80 kg | "aim 10" | **stall → deload** |
| 5×5 squat failing 3 sessions at 105 | "Repeat 105" | **deload 95 kg** (94.5 → 95; SS/StrongLifts 10 % reset) |
| 80×10 top + 70×6 back-offs | "Add → 82.5" | **repeat** (back-offs ≥ 85 % of top are working sets) |
| Lateral raise 8 kg × 3×15 | "Add 9.25 kg" | **9 kg** (next dumbbell) |
| DB bench 30 kg | plate math "5 per side" | **no plate math**; next load 32 kg |
| Weighted dips "AMRAP" | "Add → 11.25 × 8" | **"Repeat 10kg · beat 15 reps"** |
| Plank "30-60s" | read as reps | **time target** ("Hold 30–60s · add 5 s …") |
| 5×5 deadlift note "add 5kg each session" | engine added 2.5 | **+5** (program text sets the increment) |
| e1RM of a true single 100 × 1 | 103 | **100**; sets > 10 reps give no e1RM |
| Light day after a deload | every set a "PR" | **no PR** (vs all-time best e1RM); ≤ 1 PR / lift / session |
| Logged RIR | program target | **reported value** (optional RIR stepper), else null |
| End after ≥ 80 % of planned sets | workout not counted | **counted** (same threshold as T) |
| Program day after a finished workout | never advanced | **advances the next calendar day** (lazy; manual choice respected) |
| 3-day program calendar | every day = training day | **Mon/Wed/Fri train, rest between** ("Train anyway" on rest days) |

Seeded weekly sets (fractional: direct 1.0 / indirect 0.5, Pelland 2024):

| Program | Chest | Back | Shoulders | Quads | Hams |
|---|---|---|---|---|---|
| Lean Bulk (was 3-Day PPL → Upper/Lower/Full) | 9 → **10** | 9 → **10** | 9 → **11.5** | 6 → **10** | 6 → **10** |
| Fat Loss (U/L/U → Upper/Lower/Full) | 9.5 → **11.5** | 11 → **12** | — → **11.5** | 7 → **10** | 7 → **10** |
| Body Recomposition (4×/week) | **14** | **14** | **13** | **14** | **14** |
| PPL 6-Day | 14 | 22.5 | 19.5 | 17 | 13.5 |
| Strength 5×5 / Beginner Full Body | exempt (beginner) | | | | |

Name canonicalisation: `data/exerciseCatalog.ts` (mirrors the server library + secondary muscles
+ aliases) and `utils/exerciseNames.ts`. Applied on save (`logWorkoutSet` uses the canonical
name), on program rows, and on read (history folded onto canonical names; program tab and
exercise detail query every alias spelling).

## Bet 7 — Nutrition (80 kg, 180 cm, 30 y male unless noted)

| Case | Before | After |
|---|---|---|
| Cut calories | 2640 (33 kcal/kg, every goal) | **2207** (MSJ 1780 × 1.55 × 0.8) |
| Bulk calories | 2640 | **3035** (× 1.10) |
| No sex/height (today's schema) | 2640 | **2112** cut (33 kcal/kg × 0.8) + note "Add sex, height and age for Mifflin-St Jeor" |
| "Apply 175 g" with weight set | target stays 160 (no-op) | **175** |
| Apply 110 g at 80 kg | 110 | **128** (floor 1.6 g/kg) |
| Adaptive suggestion eating ~100 g vs 160 | 95 g (1.19 g/kg) | **130 g** (≥ 1.6 g/kg); today's partial day excluded |
| No weight | protein "1.8-2.2 g/kg" → 2 g, carbs/fat/kcal 0 | **70 kg reference**: 112 g protein, 2310 kcal, fat 63 g, labelled |
| Weight source | static profile weight | **regression trend** once ≥ 7 weigh-ins |
| Adaptive TDEE: 2500 kcal/day, −0.5 kg/wk for 14 d | — | **3050** (2500 + 7700 × 0.5 / 7); clamped ±25 % of formula; needs ≥ 14 d + ≥ 10 intake days |

Open Food Facts (`utils/openFoodFacts.ts`, 13 fixtures shaped after the v2 response): default
portion = `serving_quantity` (60 g bar → 60 g, not 100 g), kJ ÷ 4.184 (`energy-kj_100g` /
`energy_100g`), Atwater 4/4/9 when no energy, partial nutriments flagged in `missing`, 6 s
AbortController timeout, `offline` / `timeout` / `not_found` / `no_nutrition` / `error` with
their own messages and a manual-entry prefill. UI: distinct toast; a known product name is put
in the food search box.

## Not done / open

- Height and sex aren't in the schema (backend-sync owns it), so MSJ only activates once they
  exist; until then the 33 kcal/kg fallback + note is what users see.
- `postScore` still sends the routine %; switch to server-computed outcome when backend lands.
- The render-count harness isn't committed (needs `react-test-renderer` as a devDependency; left
  for the data-layer rewrite to avoid a lockfile conflict).
- Barcode offline queue and a real manual-entry form (prefill object is ready).
- Proactive (every 4–8 weeks) deloads, gap-since-last-session handling, RIR-based load suggestions.
- With no program selected, T is unknown so no day can be "kept" (contract-strict).
