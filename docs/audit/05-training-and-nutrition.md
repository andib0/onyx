# 05 — Training & Nutrition Logic Audit

Scope: progression engine, e1RM/PR logic, deloads, seeded programs and exercise library, the
protein and calorie targets (including the adaptive protein target, a15527a), the food database, and
barcode scanning (47df93e). This was a read-only review. The harness scripts and their raw output are
in the session scratchpad (`scratchpad/coach/harness.ts`, `seed.ts`, `volume.ts`, `*.out`). They
import the real `mobile/utils/*` and `backend/prisma/seed/*` modules and run them with `npx tsx`.

Findings are ranked by how much each one affects the product goal: **train more consistently and eat
closer to targets**.

---

## Ranked findings

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| 1 | **Critical** | Every goal gets a **maintenance calorie target (33 kcal/kg)**. A user on a cut is told to eat the same amount as a user on a bulk. | `mobile/utils/nutrition.ts:116-119,194` |
| 2 | **Critical** | The adaptive protein **"Apply" button does nothing** for any user with a weight set. The suggestion then comes back on every visit. | `nutrition.ts:97-108`, `app/(tabs)/nutrition.tsx:227-237`, `contexts/DataContext.tsx:174` |
| 3 | **High** | The adaptive protein target **follows under-eating down**, with no evidence-based floor. Example: 160 g lowered to 95 g, which is 1.19 g/kg. | `utils/adaptiveTargets.ts:30-46` |
| 4 | **High** | The bodyweight used for targets is the **static profile weight**. Logged weigh-ins never update it. | `DataContext.tsx:174`, `utils/trends.ts:112-145` |
| 5 | **High** | Progression has **no stall or deload logic**. A lifter who stalls is told "Repeat · aim 9 reps" forever. | `utils/progression.ts:34-68` |
| 6 | **High** | **PR detection only compares against the last session**, not the all-time best, and it counts every qualifying set. PR counts inflate after any light day. | `hooks/useWorkout.ts:76-95,301` |
| 7 | **High** | The program **never advances to the next day** after a workout. The selected day stays fixed and there are no scheduled rest days. | `hooks/useProgram.ts:82-113` |
| 8 | Med | The `isCompound` regex gates plate math, warm-ups and the 2.5 kg step. It matches **dumbbell, cable and machine lifts**, which gives nonsense like "DB bench 30 kg → 5 per side" or "Lat pulldown 60 → 20 per side". | `progression.ts:14`, `WorkoutSection.tsx:224-231` |
| 9 | Med | Logged RIR is the **program's target RIR** rather than what the lifter reported, so autoregulation is impossible. | `useWorkout.ts:334` |
| 10 | Med | **35 of the 42 exercise names in programs don't exist in the 42-item library.** History is keyed by exact name, so swapping exercises splits a lift's history. | `seed/programs.ts` vs `seed/exercises.ts` |
| 11 | Med | Barbell volume is **low on 2 programs**. The "Lean Bulk 3-Day PPL" trains every muscle 1×/week, with 6 quad, 6 hamstring and 4 calf sets. | volume table below |
| 12 | Med | With no weight set, carbs, fat and calories are 0, and a protein target of **"1.8-2.2 g/kg" parses to 2 g**. | `nutrition.ts:97-104,199-205` |
| 13 | Med | Barcode foods are added at a **100 g default instead of the product's serving**. A failed network call and "not found" give the same message, and there's no manual-entry fallback. | `utils/openFoodFacts.ts`, `nutrition.tsx:138-146`, `nutrition.ts:222` |
| 14 | Low | Epley e1RM has **no rep cap**. It overestimates 1-rep sets by 3.3% and drifts above 10–12 reps. | `app/exercise/[name].tsx:13-15` |
| 15 | Low | `parseRepRange` edge cases: "AMRAP" becomes 8–8, so a weighted dip at 15 reps is told to add weight with a target of 8. "30-60s" for a plank is read as reps. | `progression.ts:21-28` |
| 16 | Low | Food DB data quality is good. All 34 entries that fail a 4/4/9 check are explained by fiber or USDA-specific Atwater factors. A few labels are ambiguous or off. | section 7 |

---

## TRAINING

### 1. The progression model (exact algorithm)

`mobile/utils/progression.ts:34-68`, `suggestProgression(name, lastSets, reps)`:

1. Drop sets with no weight or weight ≤ 0. Return `null` if no sets are left, so bodyweight work gets no suggestion.
2. `topWeight` = the maximum weight in the **most recent session only**. The history comes from `workouts.service.ts:120-172`, which keeps only the latest session per exercise.
3. `topSets` = the sets at `topWeight`. The rep range comes from the first two integers in `reps`.
4. If **every** top set reached `high`, suggest `topWeight + inc` × `low`, where `inc` is 2.5 kg if the name matches the `COMPOUND` regex and 1.25 kg otherwise.
5. Otherwise, suggest the same weight and aim for `min(bestReps+1, high)` reps.

This is textbook **double progression** (Helms et al., *Muscle & Strength Pyramid*; NSCA *Essentials*, 4th ed., ch. 17), and on a rep range of 5–5 it reduces to **linear progression**. The core logic is correct. What's missing is everything around the core:

**Harness runs** (`harness.out`):

| Scenario | Output |
|---|---|
| Bench 6–10: did 10/10/10 at 60 kg, then 8/7/6 at 62.5 kg for 4 sessions | "Repeat 62.5 kg · aim 9 reps" ×4. **It never escalates**, and no reset or deload is offered. |
| Bench 6–10: did 10/10/9, then 10/9/8, then 9/8/7 (declining) | "aim 10 reps" every time. The **performance decline isn't detected**, even though it's a classic fatigue signal. |
| Squat 5×5 linear: stalls at 105 kg (5/5/4/4/3, then 5/4/4/3/3) | "Repeat 105 kg · aim 5" indefinitely. Starting Strength and StrongLifts prescribe a **10% reset after 3 failed sessions**. |
| One heavy top set at 80×10, back-offs at 70×6 | **"Add weight → 82.5"**. Only the top-weight sets are tested, so failed back-offs are ignored. |
| Lateral raise at 8 kg, 3×15 | "Add 9.25 kg". **There's no 1.25 kg dumbbell step in most gyms**; dumbbells jump 1–2 kg. |
| Weighted dips, "AMRAP" | "Add weight → 11.25 kg × **8**". AMRAP is parsed as 8–8. |
| Missed a week | Same output as if no time had passed. There's no detraining or return-to-training adjustment, and the dates are ignored. |

Also, the prefill at `WorkoutSection.tsx:77-96` uses the *suggested* weight but takes the *last session's* reps. After an "add weight" suggestion, the reps field shows 10 instead of the range bottom (6).

**Recommended additions**, each grounded in established practice:
- **Stall rule:** after 3 consecutive sessions at the same weight with no rep improvement, suggest a 10% reset or a rep-range change. This is the Rippetoe/StrongLifts reset convention, and Helms' "Pyramid" uses the same idea for double-progression stalls.
- **All working sets must qualify.** Better still, base the decision on logged RIR. With RIR ≤ target at the top of the range, add load; with RIR ≥ target + 2, add load early (Zourdos et al. 2016, *JSCR* 30(1):267-275; Helms et al. 2016, *Strength Cond J* 38(4):42-49).
- **Equipment-aware increments.** Barbell lower body: 5 kg for novices, 2.5 kg otherwise. Barbell upper body: 2.5 kg, or 1–1.25 kg with fractional plates. Dumbbell: the next dumbbell, about 2 kg. Machine or cable: the next pin, usually 2.5–5 kg. Use `ExerciseLibrary.equipment`, which already exists.
- **Gap handling:** if more than 10–14 days have passed since the last session, suggest repeating the weight or dropping 5–10%.

### 2. e1RM, trend and PR detection

- **Formula:** Epley, `w × (1 + r/30)`, rounded (`app/exercise/[name].tsx:13-15`). It's applied to every set with no rep cap, and `r=1` isn't special-cased, so a true single of 100 kg displays as 103.
- **Validity:** the Epley, Brzycki and Lombardi equations are reasonably accurate up to about 10 reps and lose accuracy beyond that. Error grows with reps (LeSuer et al. 1997, *JSCR* 11(4):211-213; Reynolds et al. 2006, *JSCR* 20(3):584-592). Brzycki is undefined at 37 reps, and NSCA tables assume ≤10. **Fix:** set `e1RM = w` when `r==1`, and skip or flag sets with `r>10` (or `r>12`). Optionally, use RIR-adjusted e1RM: Epley with `reps + RIR` (Helms/Zourdos RIR-based estimation).
- **Trend:** the detail screen charts top weight and volume for the last 8 sessions. There's **no e1RM trend line and no smoothing**, only the all-time best e1RM. A 3-session rolling max or an EWMA of best-set e1RM would show progress through rep-range changes.
- **PR detection** (`useWorkout.ts:76-95`) compares each set with the *last session only*. It counts a PR if the weight is higher than that session's best, or the reps are higher at the same weight. As a result:
  - after a deload or light week, every set of the next session fires a "PR" (false positives, which undermines trust);
  - three sets at +2.5 kg count as **3 PRs**;
  - a new all-time best e1RM at a lower weight with more reps isn't recognized.

  **Fix:** compare with an all-time best per exercise (best e1RM or best weight-at-reps), count at most one PR per exercise per session, and ideally compute this on the server.

### 3. Deload detection

**There is none.** No code references deloads, fatigue or readiness. Established practice:
- **Proactive deloads** every 4–8 weeks (Israetel/RP mesocycle model; Bell et al. 2023, *Sports Med Open*, deload Delphi consensus: a 5–7 day reduction in volume, typically about 30–50%, with intensity kept).
- **Reactive deloads:** e1RM falls across 2+ sessions, reps fall at the same load, or RPE creeps up at the same load (Zourdos/Helms RPE work).

Minimal implementation, using data the app already stores: if the best-set e1RM for ≥2 main lifts falls ≥5% over 2 sessions, or the weeks since the last deload reach ≥6, suggest a 1-week deload with sets ×0.5 at the same weights.

### 4. Seeded programs (`backend/prisma/seed/programs.ts`)

These are weekly hard sets per muscle. Direct sets count 1.0 and indirect sets 0.5 (the fractional method, Pelland et al. 2024 meta-regression). Frequency is in parentheses. Each program is assumed to be run as its description intends: 5×5 alternating A/B 3×/week, recomp Upper/Lower ×2.

| Program | Chest | Back | Side/front delts | Rear delts | Biceps | Triceps | Quads | Hamstrings | Glutes | Calves |
|---|---|---|---|---|---|---|---|---|---|---|
| Lean Bulk 3-Day PPL | 9 (1×) | 9 (1×) | 7.5 (1×) | 6 | 9.5 | 9.5 | **6 (1×)** | **6 (1×)** | 4.5 | **4** |
| Fat Loss High Volume (U/L/U) | 9.5 (2×) | 11 (2×) | 8 | 7 | 11.5 | 11.5 | **7 (1×)** | **7 (1×)** | 5.5 | 4 |
| Strength 5×5 | 7.5 | 8.3 | 7.5 | 3.8 | 3.8 | 7.5 | 15.8 (3×) | 1.5 | 9 | 0 |
| Beginner Full Body | 9 (3×) | 9 (3×) | 5.5 | 4.5 | 4.5 | 4 | 6 (2×) | 5 | 4.5 | 3 |
| Body Recomp (U/L ×2) | 14 | 14 | 9 | 4 | 11 | 11 | 14 | 14 | 11 | 8 |
| PPL 6-Day | 14 | 19.5 | 17.5 | 9.5 | 19 | 18.5 | 18.5 | 15 | 11 | 8 |

Reference ranges:
- Schoenfeld, Ogborn & Krieger 2017 (*J Sports Sci* 35(11)): there's a dose–response, and ≥10 sets/muscle/week beats <5.
- Schoenfeld et al. 2016 (*Sports Med* 46(11)): training each muscle 2×/week beats 1×/week at matched volume.
- Israetel/RP landmarks: MEV is about 6–8 sets for most muscles and MAV is about 12–20.

Observations:
- **Lean Bulk 3-Day PPL** is described as being for "intermediate lifters", yet each muscle is trained once a week. Legs get 6 sets each for quads and hamstrings, at or below MEV. The "Legs + Shoulders" day has 22 sets, the longest session in the catalog. This is the weakest hypertrophy program in the set. **Fix:** convert it to a 3-day full-body or Upper/Lower/Full routine at 2×/week.
- **Fat Loss** says "more training frequency", but the lower body gets 1 day out of 3. Its "Maintain weight during cut" notes conflict with the engine, which still pushes for more weight.
- **5×5:** the Deadlift note says "add 5 kg each session", but the engine adds 2.5 kg (`progression.ts:30-32`). Arms and calves get no direct work, which is acceptable for a strength-focused program.
- **PPL 6-Day** delt and arm volume (17–19 sets) is high but within RP MRV estimates. It's acceptable for advanced lifters.
- **Recomp and Beginner** are reasonable.
- **No program has core work** except Beginner (plank), and none includes a deload week.
- **Data errors:**
  - Inconsistent names: "Bench Press", "Flat Bench Press" and "Flat Barbell Bench Press" all name the same lift; likewise "Squats" and "Barbell Squats". Programs and the library also differ: "Barbell Rows" vs "Barbell Row", "Cable Flyes" vs "Cable Fly", "Lat Pulldowns" vs "Lat Pulldown".
  - **35 of the 42 distinct names in programs are not in the library.**
  - Because `exercise-history` matches by exact name (`workouts.service.ts:126`), switching between "Bench Press" programs and "Barbell Bench Press" from the editor library starts a lift's history from zero.
- Reps strings that the engine can't use: "AMRAP", "12 each" (fine), "30-60s" (read as reps).

### 5. Exercise library (`seed/exercises.ts`, 42 items)

- **Coverage:** Chest 7, Back 8, Quads 6, Hamstrings 2, Glutes 1, Calves 1, Shoulders 5, Biceps 4, Triceps 4, Core 4.
- **Missing exercises that the programs themselves use:** Hack Squat, Goblet Squat, Stiff-Leg Deadlift, Tricep Kickback, Reverse Fly, Incline DB Curl, seated and standing calf variants, Weighted Pull-up, Tricep Dip.
- **Common staples also missing:** Pec Deck/Machine Chest Press, Machine Row, Chest-Supported Row, Pendlay Row, Seated Leg Curl vs Lying Leg Curl, Nordic Curl, Good Morning, Back Extension, Cable Lateral Raise, Upright Row, Shrug, Hip Abduction, Smith Machine variants, Sumo and Trap-Bar Deadlift, Step-Up.
- **Data quality:** there's only one `primaryMuscle` per exercise, with no secondary muscles. Deadlift is listed as "Back" only. There's no movement pattern, no increment or `loadType`, and no unilateral flag. The `equipment` field exists but is **never used** by progression or plate math, even though it's exactly what finding 8 needs.

---

## NUTRITION

### 6. Protein and calorie targets

**Derivation** (`utils/nutrition.ts:86-137`, using `user.weight` from `DataContext.tsx:174`):
- Protein range = weight × goal-specific g/kg: bulk and recomp 1.8–2.2, cut **2.0–2.4**, strength and general 1.6–2.0. The target shown is the midpoint (`parseTargetNumber`).
- Fat = 0.7–1.0 g/kg.
- Carbs = (`weight × 33` − protein midpoint × 4 − fat midpoint × 9) / 4, ±15%.
- The calorie target is **not computed from the goal**. `computeMacroTargets` sums the macro midpoints, so it always equals about `33 × BW`.

**Harness at 80 kg:**

| Goal | Protein target | Calorie target | Goal text shown |
|---|---|---|---|
| bulk | 160 g | **2640** | "+200-300 kcal/day" |
| cut | 176 g | **2640** | "-300-500 kcal/day" |
| recomp / strength / general | 160 / 144 / 144 g | **2640** | — |

**Issues:**
1. **The calorie target ignores the goal** (finding 1). The fix is to apply the goal offset to the estimated TDEE, for example bulk +250, cut −400 (or −0.5–0.75%BW/week), strength +150. Aragon et al. 2017 (ISSN position stand on diets and body composition, *JISSN* 14:16) and Helms, Aragon & Fitschen 2014 (*JISSN* 11:20) both support a rate-based deficit or surplus.
2. **The TDEE model is crude.** 33 kcal/kg ignores sex, age, height and activity. Mifflin-St Jeor × an activity factor is the standard. The app collects `age`; adding height and sex would let it use MSJ. Better still, do *adaptive TDEE* from the weight-trend slope it already computes (`trends.ts:112-145`) plus logged calories, as MacroFactor does with energy balance: 7700 kcal/kg ≈ 1 kg.
3. **Protein ranges are evidence-aligned.**
   - Morton et al. 2018 (*Br J Sports Med* 52:376) found gains plateau at about **1.62 g/kg/day** (95% CI up to about 2.2).
   - The ISSN 2017 position stand (Jäger et al., *JISSN* 14:20) recommends 1.4–2.0 g/kg, with higher intakes in a deficit.
   - Helms 2014 recommends 2.3–3.1 g/kg of *lean* mass in a deficit, which roughly matches 2.0–2.4 g/kg total for lean lifters.
   - For users with obesity, the target should be based on goal or lean weight rather than total BW. A 120 kg user on a cut gets 264 g/day, which is excessive.
4. **Weight source** (finding 4): `user.weight` is a static profile `Decimal`, set at onboarding (`app/onboarding.tsx:69`) or in settings. The logged daily bodyweight (`DailyLog.bw`) and the regression trend in `buildWeightTrend` never feed into targets. On a 10 kg cut, targets stay anchored to the starting weight. **Fix:** use the latest point of the 7-day EWMA or regression from `buildWeightTrend`, and fall back to the profile weight.
5. **No weight** (finding 12):
   - Protein falls back to the `proteinTarget` preference string. The default "140-150 g/day" works and gives 145.
   - The hard-coded fallback `"1.8-2.2 g/kg"` (`nutrition.ts:98`) parses to **2 g**.
   - Carbs, fat and calories are all 0, so there is no calorie ring or comparison.
6. **The adaptive protein target (a15527a)** has two problems:
   - **The "Apply" button is a no-op when a weight is set** (finding 2). `handleApplyProteinTarget` writes `preferences.proteinTarget`, but `buildNutritionTargets` only reads that preference in the *no-weight* branch (`nutrition.ts:97-104`). Harness: an 80 kg user applies "110 g/day" and the target is still **160**. The toast says "Protein target set to 110g/day", nothing changes, and the nudge reappears.
   - **The direction is backwards** (finding 3). The suggestion is `round5(avg of last ≤14 logged days)`, shown when the gap from target is ≥12%, and it can lower the target without limit. Harness: 160 g target, eats about 100 g, so it suggests **95 g (1.19 g/kg)**, below every evidence-based floor. A coaching feature should *close the gap toward the target*, not move the target to match the gap. **Fix:**
     - clamp the suggestion to at least 1.6 g/kg (Morton), or at least 1.2 g/kg for general health;
     - only "lower" when intake exceeds the upper bound;
     - otherwise offer behavioural help, such as a protein-dense swap or a 25–40 g distribution per meal (Schoenfeld & Aragon 2018, *JISSN* 15:10).
   - Smaller issues:
     - Today's *partial* day is included in the average, because the history is in ascending order with today last.
     - Days with 0 g are dropped, which is reasonable, but "7 of 14 days" is a thin sample for changing a target.

### 7. Food database (`seed/foods.ts`, 160 items)

**4/4/9 consistency for all 160 items** (`seed.out`): 34 items deviate by more than 10% under plain 4/4/9. Every one is a fruit or vegetable plus soy protein isolate. With fiber counted at 2 kcal/g, 30 fall within ±11%. The rest (mushrooms +19%, cucumber +14%, corn +12%, raspberries −11%) match USDA values that use food-specific Atwater factors. Mushrooms have a protein factor of 2.62. **None of these are data-entry errors.** Soy protein isolate (338 vs 383 by 4/4/9) is USDA's own value (SR 335 kcal, P 88.3, F 3.4), and the gap comes from soy's 3.47 protein factor.

**USDA FoodData Central (SR Legacy) spot check, 20 items:**

| Item | Seed (kcal/P/C/F) | USDA | Verdict |
|---|---|---|---|
| Chicken breast, raw | 120/22.5/0/2.6 | 120/22.5/0/2.6 | match |
| Chicken breast, cooked | 165/31/0/3.6 | 165/31/0/3.6 | match |
| Ground beef 90/10, raw | 176/20/0/10 | 176/20/0/10 | match |
| Salmon, Atlantic farmed, raw | 208/20/0/13 | 208/20.4/0/13.4 | match |
| Tuna canned in water | 116/25.5/0/0.8 | 116/25.5/0/0.8 | match |
| Egg, whole | 155/13/1.1/11 | 155 (hard-boiled), 143 (raw) | match for cooked; label doesn't say which |
| Greek yogurt 0% | 59/10/3.6/0.7 | 59/10.2/3.6/0.4 | match |
| Milk, whole | 61/3.2/4.8/3.3 | 61/3.2/4.8/3.3 | match |
| Cheddar | 403/25/1.3/33 | 403/24.9/1.3/33.1 | match (older SR) |
| **Mozzarella part-skim** | 280/28/3.1/17 | **254/24.3/2.8/15.9** | **+10% kcal** |
| White rice, cooked | 130/2.7/28/0.3 | 130/2.7/28.2/0.3 | match |
| Oats, dry | 389/17/66/7 | 389/16.9/66.3/6.9 | match |
| Banana | 89/1.1/23/0.3 | 89/1.1/22.8/0.3 | match |
| Avocado | 160/2/9/15 | 160/2/8.5/14.7 | match |
| Lentils, cooked | 116/9/20/0.4 | 116/9/20.1/0.4 | match |
| Almonds | 579/21/22/50 | 579/21.2/21.6/49.9 | match |
| Peanut butter | 588/25/20/50 | 588/25.1/20/50.4 | match |
| **Bacon** | 541/37/1.4/42 | 541 (pan-fried); **417 raw** | label should say "cooked" |
| **Ghee** | 900/0/0/100 | 876/0.3/0/99.5 | +2.7%, minor |
| Kale | 49/4.3/9/0.9 | 49 (old SR); 35 (FDC 2019+) | outdated but harmless |

**Verdict:** the seed nutrient data is high quality, with about 95% matching USDA exactly. The real gaps are structural:
- **There are no household or serving units.** Every food is logged at 100 g, and the user has to know gram weights (1 egg ≈ 50 g, 1 slice of bread ≈ 30 g).
- Raw and cooked versions are easy to confuse for the same item; both are present, which helps.
- There are only 160 generic foods, with no branded or regional coverage.
- The search isn't fuzzy (`@@index([name])` only).

The low-effort fixes are to add `servingName` and `servingGrams` to `Food`, and to relabel "Bacon" as "Bacon (cooked)" and "Eggs (whole)" as "Eggs (whole, boiled)".

### 8. Barcode scanning (`utils/openFoodFacts.ts`, `BarcodeScannerSheet.tsx`, `nutrition.tsx:138-146`)

- **Source:** the Open Food Facts v2 API (`world.openfoodfacts.org/api/v2/product/{code}.json?fields=product_name,brands,nutriments`), with no key and a custom User-Agent. The scanner reads EAN-13, EAN-8, UPC-A and UPC-E, with a ref guard against double scans.
- **Coverage expectations:** OFF has about 3–4M products. Coverage is strongest for EU and French packaged goods and patchy for US and Balkan regional brands, and it's crowd-sourced, so nutriments are sometimes missing or wrong. Expect roughly 60–85% hit rates on EU groceries and lower elsewhere. Fresh and unpackaged foods have no barcodes.
- **Per-100g handling:** the app reads `*_100g` fields correctly. These are per 100 g, or **per 100 ml for liquids**, which is treated as grams, so drinks are off by their density, about 3–5%.
- **Bugs and gaps:**
  1. **The default amount is 100 g, not the product's serving.** `foodToMealTemplate` sets `grams: 100`, and `serving_size`/`serving_quantity` aren't requested. A 45 g protein bar is logged as 100 g, or 2.2× the real amount, unless the user edits the grams. Ignoring the serving is the most common way barcode logging goes wrong. **Fix:** request `serving_quantity` and default to it.
  2. **Energy:** if a product has only `energy_100g` or `energy-kj_100g` and no `energy-kcal_100g`, calories are `null`, the "Cal" tag is omitted, and the item **silently counts as 0 kcal** (`nutrition.ts:216-217`, `computeConsumedMacros`). **Fix:** fall back to kJ ÷ 4.184, or calculate from macros.
  3. Products with partial nutriments (for example no fat) are accepted and their missing macros count as 0, with no warning.
  4. **Offline, timeout, 404 and "no nutriments" all show the same toast**, "No nutrition data found for that barcode" (`catch {return null}`). There's no fetch timeout, no retry, no queue for offline use, no local cache of scanned codes, and **no manual-entry fallback** with the barcode prefilled.
  5. OFF foods are synthetic (`id: off_<code>`) and are never saved to the backend. If the "Save to My Foods" path (`addUserFood(food.id)`) is reachable from Recent Foods, it would fail with a foreign-key error (P2003 → 400). Confirm in the UI.
  6. `num()` rounds to 0.1 g. That's fine.

---

## Fix priority (biggest effect on consistency and adherence first)

1. Apply the goal offset to calories, and replace 33 kcal/kg with MSJ plus adaptive TDEE (findings 1 and 4).
2. Make the protein preference win over the weight-derived default, or have "Apply" store g/kg. Add a clamp of at least 1.6 g/kg (findings 2 and 3).
3. Feed the weight-trend EWMA into targets (finding 4).
4. Auto-advance the program day after a workout, and add a weekly schedule with rest days (finding 7).
5. Add stall and deload rules and RIR-based autoregulation, and log *actual* RIR (findings 5 and 9).
6. Make PR detection all-time, e1RM-based and at most one per exercise per session (finding 6).
7. Use `ExerciseLibrary.equipment` for increments, plates and warm-ups (finding 8). Normalize exercise names between programs and the library (finding 10).
8. Barcode: default to the serving size, fall back to kJ, show separate offline and not-found messages with manual entry (finding 13).
9. Fix the PPL-3 and Fat Loss programs to train every muscle twice a week and reach MEV (finding 11).

## Sources
- Morton RW et al. 2018, *Br J Sports Med* 52(6):376-384: protein meta-analysis, plateau at about 1.62 g/kg.
- Jäger R et al. 2017, ISSN position stand: protein and exercise, *JISSN* 14:20.
- Aragon AA et al. 2017, ISSN position stand: diets and body composition, *JISSN* 14:16.
- Helms ER, Aragon AA, Fitschen PJ 2014, *JISSN* 11:20: contest-prep nutrition.
- Schoenfeld BJ & Aragon AA 2018, *JISSN* 15:10: protein per meal.
- Schoenfeld BJ, Ogborn D, Krieger JW 2017, *J Sports Sci* 35(11):1073-1082: volume dose–response.
- Schoenfeld BJ et al. 2016, *Sports Med* 46(11):1689-1697: training frequency.
- Pelland JC et al. 2024, SportRxiv / *Sports Med*: fractional set counting, volume and frequency meta-regression.
- Zourdos MC et al. 2016, *JSCR* 30(1):267-275: RIR-based RPE scale.
- Helms ER et al. 2016, *Strength Cond J* 38(4):42-49: RPE/RIR application.
- Bell L et al. 2023, *Sports Med Open* 9:87: deloading Delphi consensus.
- LeSuer DA et al. 1997, *JSCR* 11(4):211-213; Reynolds JM et al. 2006, *JSCR* 20(3):584-592: 1RM prediction accuracy versus reps.
- Epley B 1985 (*Poundage Chart*); Brzycki M 1993, *JOPERD* 64(1):88-90.
- Mifflin MD, St Jeor ST et al. 1990, *Am J Clin Nutr* 51(2):241-247.
- USDA FoodData Central, SR Legacy: https://fdc.nal.usda.gov/ (soy protein isolate cross-check: https://mobile.fatsecret.com/calories-nutrition/usda/soy-protein-isolate)
- Open Food Facts API docs: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorial-off-api/ ; `_100g` / `_serving` field semantics: https://github.com/openfoodfacts/api-documentation/issues/64
- NSCA, *Essentials of Strength Training and Conditioning*, 4th ed. (Haff & Triplett 2016), progression and 1RM tables.
