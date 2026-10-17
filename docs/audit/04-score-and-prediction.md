# 04 — Does the Day Score measure a good day, and what predicts a missed session?

**Audit date:** 2026-10-17 · **Scope:** `mobile/contexts/TimelineContext.tsx`, `mobile/utils/{trends,achievements,insights,adaptiveTargets,nutrition,normalize}.ts`, `mobile/app/(tabs)/focus.tsx`, `mobile/hooks/{useWorkout,useProgram}.ts`, `backend/src/services/{scores,sync}.service.ts`, `backend/prisma/schema.prisma`.
**No repo source was modified.** Scripts: `docs/audit/scripts/` (copied from the scratch dir `…/scratchpad/score/`).

The owner's goal: *over months, the app should measurably make me train more consistently and eat closer to my targets.* This audit checks whether the app's central number pushes toward that goal (Task A). It then tests a method for finding early warning signs of a missed session (Task B).

---

## TL;DR

| | Finding |
|---|---|
| **A: verdict** | **The claim is disproved.** The Day Score measures how many checkboxes you ticked. It does not measure how well you executed training and nutrition. A completed workout is worth **6.7%** of the score (1 block out of 15). Supplements are worth **26.7%**. Protein grams and calories are **never inputs** to the score. You can reach **86.7%** with no training (93.3% if you also tick the "Train" block), and **100%** with any protein intake. |
| **A: streak** | The streak breaks only after **two consecutive** days under 80. A single missed day leaves it at **0 from the morning after the miss until the evening, when today's score crosses 80**. Two misses exactly 7 days apart break it, so "one grace day per week" is really one per 8 days. The app loads only 30 days of history, so the streak **can never show more than 31**. The "Iron habit" badge (train 30 days) is **out of reach for a 4×/week lifter**: at most 17 workout days fit in the 31-row window. |
| **A: planned rest** | The app has no concept of a rest day. Once a program day is selected, every day gets a "Program session" block. A perfectly executed rest day therefore tops out at 87–93, and a 100 is impossible on it. |
| **B: method** | Simulator plus a feature pipeline that is safe from leakage, run on 3 seeds × 16 simulated users × 2 years. The model trains on year 1 and is tested on year 2. The same `features.py`/`analyze.py` run unchanged on a real SQL export (§B6). |
| **B: result (simulated only)** | Predicting a missed planned session the day before: AUC **0.63–0.67** with the full model. Baselines: **0.51–0.52** for weekday only, **0.58–0.62** for weekday + the user's own miss rate. Same-day predictions are capped at an AUC of about **0.74**, even with perfect knowledge of the hidden state. The earliest robust signal is **engagement withdrawal**: a 3-day drop in logged protein (meals not logged), in the Day Score, and in morning supplement ticks. It adds signal at 1–3 days of lead time and is gone by day 5. |
| **B: what you probably don't know** | (1) **Last night's sleep is never available before the training decision.** The app only captures it at the evening check-in (19:00+), so a well-documented predictor cannot be used. (2) "Logging later in the morning" is a weak signal unless you compare it with the **same weekday**; the weekend shift swamps it. (3) **About 36% of simulated streak breaks fall on a Sunday** (two weekend days in a row). (4) **14–17% of "missed" sessions in the data are trained-but-not-logged.** |

**Caveat:** every Task B number comes from simulated data built on assumptions I chose (cited below). It shows that the method works: no leakage, time split, honest baselines, a path to rerun on real data. It is **not** evidence about the owner. Run §B6 on real data before acting on any signal.

---

## Task A — "DailyScore measures a good day"

### A1. The exact formula

The client computes the score in `TimelineContext.tsx` (`timelineProgressPercent`). `focus.tsx` posts it every 1.5 s as `postScore({score: timelineProgressPercent, …})`. The backend (`scores.service.ts`) only clamps the value to 0–100 and upserts it. It does no scoring of its own.

```
timeline = S ∪ P ∪ N ∪ K
  S = user ScheduleBlocks                          done ⇔ Completion(date, block).isComplete (manual tick)
  P = 1 "Program session" block  iff  a program day is selected  AND  a block whose title/tag
      contains "warm-up"/"gym" or tag=="Training" exists AND a later block starts after it ends
                                                   done ⇔ workoutCompletedToday (last set of last exercise logged)
  N = min(#ScheduleBlocks tagged "Nutrition", #MealTemplates for this WEEKDAY)
                                                   done ⇔ mealLog[date][template] (manual tick)
  K = all Supplements                              done ⇔ suppLog[date][supp] (manual tick)

DailyScore.score = round(100 × done / |timeline|)        (0 if timeline empty)
```

`DailyScore.protein` and `DailyScore.calories` are stored with the score, but **nothing in the score formula uses them**. They are the template macros of checked meals (`computeConsumedMacros`), not what was eaten. The starter meal templates have no macro tags, so these values stay 0 until the user edits the templates. Only `adaptiveTargets.ts` reads them, to nudge the protein target **toward what you actually eat**.

Starter account (`sync.service.ts` STARTER_*): 7 schedule + 1 program + 3 nutrition + 4 supplements = **15 equally weighted blocks**. Output of `score_audit.py`:

| Component | Weight | What it actually measures |
|---|---|---|
| Workout (program block) | **6.7%** | Last set of the last exercise completed |
| "Train" schedule tick | 6.7% | A self-reported tick, independent of the workout |
| Meal checks (3 nutrition blocks) | 20.0% | A template was ticked; portion size is ignored; a 4th meal never counts |
| Meal *schedule* ticks (Breakfast/Lunch/Dinner) | 20.0% | The same meals counted a second time through a different tick |
| Supplements (4) | **26.7%** | Ticks |
| Wake / deep work / wind-down | 20.0% | Ticks |

Adding more habits dilutes training further. With 17 schedule blocks and 8 supplements, the workout weighs 3.4%. If no "Training/gym/warm-up" block exists, or nothing comes after it, the workout weighs **0%**.

### A2. Counter-examples (from `score_audit.py`)

| Day | Score | Streak? |
|---|---|---|
| A1: skipped training, ate half portions (≈50% protein), ticked everything else | **87** | counts |
| A2: same as A1, but also ticked "Train" | **93** | counts |
| B3: trained 90% of the sets, then pressed Stop (`stop()` never sets `completedToday`) | 93 | counts, **with no credit for the workout** |
| B2: full session, on-target macros, no supplements or routine ticks | **53** | miss |
| B1: full session, hit protein/kcal eating foods off the templates, ticked nothing else | **13** | miss |
| R1: planned rest day executed perfectly | 87 (93 if "Train" ticked) | counts, but 100 is impossible |

**Share of the maximum reachable without training:** 86.7% (honest) or 93.3% (with "Train" ticked). **Without hitting protein:** 100%. **Without training and without any meal tick:** 46.7%. An outcome-blind day clears the 80 streak bar comfortably.

The simulated cohort (`diagnostics.py`, 3 seeds) gives a check on the population level:
- Of the days scored ≥80, **39–44%** were bad days: a planned session missed (6.5–9.3%) or true protein below 90% of target (35–38%).
- Of the days scored <80, **34–36%** were on plan for both training and protein.
- Spearman correlation between the app score and true day quality is **0.27–0.33**.

### A3. Streak, grace and badge edge cases

All of these were reproduced with a faithful port of `scoreStreak` / `longestRun`:

1. **The streak shows 0 the morning after a single miss.** `startOffset = 1` when today is below 80, and grace requires `streak > 0`. Yesterday's miss is therefore hit before anything has been counted, and the streak reads 0. Once today crosses 80 the full streak comes back (E1: 0 → 19). The app tells you the chain is broken during exactly the window where the abstinence-violation ("what-the-hell") effect operates.
2. **What actually breaks a streak** is two consecutive sub-80 days, or days without a row. That explains 100% of simulated breaks, and 36% of them fall on a **Sunday**: weekend logging drops, and Saturday plus Sunday are consecutive. One day before the break, yesterday's score predicts it almost perfectly (AUC 0.95). The mechanics are deterministic, not behavioural.
3. **Grace window off by one:** misses on d-3 and d-10 break the streak (`daysAgo - lastGrace > 7`).
4. **A day with no sync counts as a miss.** If you train but don't open the Focus tab, no `DailyScore` row is written (the snapshot is posted from a `focus.tsx` effect). Past rows are never recomputed, so retro-ticking yesterday does nothing.
5. **History is capped at 30 days.** `DataContext` calls `getScores(30)`, so the streak is capped at 31 (E5: a 400-day run shows 31). `longestRun` ignores grace, so "best streak" can be smaller than the current streak (E6: 28 vs 10).
6. **Badges:** `gym_30` ("Train 30 days") counts `workoutDone` inside the 31-row window, so a 4×/week lifter maxes out at about 17. `daysTracked` is capped at 31 in the same way.
7. **Rest days:** `trainingDayActive = !!selectedProgramDay`, and the program day never advances by calendar. Rest and training days are indistinguishable, so rest days are always penalised by one block.
8. **Time zones:** client keys use local time (`todayKey`). `getFullState` uses the UTC date, and `getScores` uses a UTC window start. Between 00:00 and 02:00 Belgrade time the server's "today" is yesterday. `workoutCompletedToday` is only restored on mount and never cleared at midnight. If the app stays open past midnight, the next day's snapshot can carry `workoutDone=true` from the previous day.
9. **Insights are circular.** "Training lifts everything" compares scores that *contain* the workout block, so trained days score at least 6.7 points higher by construction. The "sleep → adherence" insight measures checkbox completion.

### A4. Proposed replacement: an Outcome Score that knows about planned rest

Keep the current percentage as a separate **Routine** ring (habits, supplements). Score the outcomes that matter:

```
Inputs for day d
  plan(d) ∈ {train, rest}  — NEW: ProgramDay.weekday[] (or DailyLog.day; "Rest" = rest)
  setsDone(d), setsPlanned(d) — WorkoutSetLog count / Σ ProgramExercise.sets for the day
  P(d), K(d) — protein g / kcal actually logged (MealLog ⋈ MealTemplateTag × grams/100;
               snapshot into DailyScore at day close so later template edits don't rewrite history)
  Pt, Kt — targets (NEW numeric columns; proteinTarget is currently a free-text string)
  bwSlope — kg/week, OLS over the last 14 DailyLog.bw values; g = goal rate (NEW pref)

Components (each 0..1, or "unknown" if no data)
  T  = plan=train ? min(1, setsDone / (0.8·setsPlanned)) : 1         # planned rest = full credit
  Pr = min(1, P / Pt)                                                 # unknown if no meal logged
  Ca = |K/Kt − 1| ≤ 0.05 ? 1 : max(0, 1 − (|K/Kt − 1| − 0.05)/0.15)  # 0 at ±20%
  Bw = max(0, 1 − |bwSlope − g| / 0.5)                               # same value all week

OutcomeScore = 100 · Σ w_i·c_i / Σ w_i  over known components,  w = {T:.40, Pr:.30, Ca:.20, Bw:.10}
  (day is "unscored" — neither hit nor miss — if both Pr and Ca are unknown)

Kept day   = T ≥ 1 AND Pr ≥ 0.85                     # outcome-based, not 80% of ticks
Streak     = consecutive kept days; 1 grace per ISO week (not rolling-8);
             display = streak through yesterday + "today pending" (never 0 before day end);
             computed server-side in UserPreferences.timezone over the full history.
Weekly KPI = sessions done / planned (target ≥ 1 miss allowed) and protein-days ≥ 5/7.
```

In simulation, this score correlates with true day quality at **ρ = 0.50–0.56**, against 0.27–0.33 for the current score. Part of that gap is circular: "true quality" uses the same components. The point is direction, not magnitude.

---

## Task B — Earliest signal of a missed session or a broken streak

### B1. Generator (`simulate.py`)

16 users × 730 days per seed, 3 seeds (7, 11, 23), about 35k user-days in total. There are five archetypes (steady, perfectionist, night-owl, stress-prone, fader) with random traits: 3–5 planned weekdays, chronotype, sleep sensitivity, what-the-hell strength, and engagement decay.

The output tables use the Prisma names and columns: `daily_log`, `workout_session`, `workout_set_log`, `completion`, `supplement_log`, `meal_log` (+ protein/kcal), `daily_score`. The score uses the starter 15-block formula.

The hidden state is stored in `_truth.csv` and is **never used as a feature**. It holds an AR(1) motivation process, stress episodes, illness and travel.

Each generative assumption is directional and cited. The magnitudes are my own choices:

| # | Assumption | Source |
|---|---|---|
| G1 | Short sleep → less exercise the next day; sleep debt → later wake/first log | Baron et al. 2013, *J Clin Sleep Med* 9(8); Kline 2014, *Am J Lifestyle Med* 8(6) |
| G2 | Weekend: later sleep/wake, more intake, weight bump | Roenneberg et al. 2012, *Curr Biol* 22(10); Racette et al. 2008, *Obesity* 16(8); Orsama et al. 2014, *Obes Facts* 7(1) |
| G3 | Fresh-start bump on Mondays and the 1st of the month | Dai, Milkman & Riis 2014, *Manage Sci* 60(10) |
| G4 | A lapse raises the odds of the next lapse ("what-the-hell"); strength varies by user, including about 0 | Polivy & Herman 1985, *Am Psychol* 40(2); Cochran & Tesser 1996; Lally et al. 2010, *Eur J Soc Psychol* 40(6) |
| G5 | Self-monitoring and app use decay over months | Burke, Wang & Sevick 2011, *J Am Diet Assoc* 111(1); Helander et al. 2014, *JMIR* 16(4) |
| G6 | Gym habit builds with frequency | Kaushal & Rhodes 2015, *J Behav Med* 38(4) |
| G7 | Stress → less exercise. **Assumption, not from the literature:** work stress ramps up over 1–4 days; illness has no ramp | Stults-Kolehmainen & Sinha 2014, *Sports Med* 44(1) |

G7's ramp, and the fact that one latent motivation process drives both logging and training, are **what make any leading indicator possible**. This is the most important caveat: the "engagement" finding is partly built into the generator.

### B2. Features (`features.py`)

Every feature can be computed from the app's own tables and uses only rows dated ≤ t−L. Rolling baselines use strictly earlier days.

- **Logging behaviour:** first-log hour (min of completedAt/takenAt/eatenAt/startedAt) as a deviation from the 28-day median, and from the **same-weekday** median (8 weeks), plus a 7-day slope. Number of logs yesterday and its 3-day ratio to baseline. AM-supplement miss rate (3-day). Check-in skipped (3-day). Days since the app was last opened.
- **Body/outcomes:** last logged sleep, 3-day sleep mean and deviation, steps deviation, protein ratio (3-day), protein-deficit run length, kcal over target yesterday.
- **Score/training:** last score, 3-day mean, deviation from baseline, current app streak, days since last session, last planned session missed, 14-day miss rate, last session partial, session-start-time drift.

Calendar fields that are known in advance (weekday of the target day) are allowed.

### B3. Evaluation (`analyze.py`)

- **Targets:** (1) planned day with no `WorkoutSession` (the label the app can see); (2) app streak alive at the end of t−1 and 0 at the end of t.
- **Leads:** L ∈ {1, 2, 3, 5, 7} days.
- **Split:** train on dates before the midpoint (year 1), test on year 2. Users are pooled.
- **Models:** B0 = weekday one-hot; B1 = B0 + the user's own train-period miss rate; B2 = B1 + recency (last miss, days since session, 14-day miss rate); full logistic regression; gradient boosting.
- **Metrics:** AUC with a 95% cluster bootstrap over users, average precision, precision@top-10%. For each single feature: AUC alone (sign chosen on train data only), ΔAUC over B1, and how many users have a per-user AUC above 0.55.

### B4. Results (held-out year 2; the three numbers in each cell are seeds 7 / 11 / 23)

**Missed planned session** (test base rate 0.31–0.33):

| Lead | B0 weekday | B1 + user rate | B2 + recency | Full logistic [95% CI, seed 7] | P@10%: B1 → full |
|---|---|---|---|---|---|
| 1 d | .52/.52/.51 | .58/.62/.59 | .63/.67/.62 | **.65/.67/.63** [.61–.68] | .49 → **.55/.61/.54** |
| 2 d | — | .58/.62/.60 | .62/.65/.62 | .64/.65/.62 | .50 → .54 |
| 3 d | — | .59/.62/.60 | .61/.64/.61 | .63/.65/.61 | .49 → .52 |
| 5 d | — | .59/.62/.60 | .60/.63/.60 | .60/.62/.60 (≈ baseline) | — |
| 7 d | — | .58/.62/.60 | .60/.62/.60 | .60/.61/.58 (≈ baseline) | — |

Gradient boosting never beat the regularised logistic regression; there isn't enough data per user for it to help. **Ceiling:** even with perfect knowledge of the same-day hidden state (stress, motivation, sleep, illness), the AUC is only **0.71–0.75**, because missing a session is inherently noisy.

**Strongest single features** (ΔAUC over B1 at lead 1 → lead 3; users with AUC > .55 at lead 1):

| Feature | Seed 7 | Seed 11 | Seed 23 |
|---|---|---|---|
| 3-day logged protein ratio (`protein_ratio3`) | +.066 → +.036 (15/16) | +.043 → +.029 (14/16) | +.022 → +.009 (10/16) |
| 3-day Day Score mean (`score_mean3`) | +.063 → +.044 (13/16) | +.044 → +.022 (13/16) | — → +.010 |
| AM-supplement miss rate, 3 days (`am_supp_miss3`) | +.057 → +.035 (12/16) | +.030 → +.017 (12/16) | +.018 → +.010 (8/16) |
| Same-weekday first-log drift (`first_log_dev_wd`) | +.033 → +.006 | +.014 → +.006 | +.014 → +.002 |
| Last logged sleep (`sleep_last`) | +.021 → +.011 | +.014 → +.008 | +.011 → +.005 |

**Streak break:** at lead 1–2 the AUC is 0.95–0.97, driven by yesterday's score (the mechanical two-day rule from A3.2). At lead ≥ 3 no model beats weekday alone (0.73–0.78 at L3, 0.67–0.71 at L7). Predicting streak breaks mostly predicts **Sundays**.

### B5. The single earliest, most robust signal (simulated)

The best candidate is **a 3-day drop in logged intake: a falling `protein_ratio3`, which means meals stopped being logged.** The 3-day Day Score mean and morning supplement ticks are interchangeable proxies for the same thing.
- In all three seeds it is in the top group at lead 1.
- It works within most individual users, not just between users.
- It still adds signal at **3 days of lead time**, and it is gone by day 5.
- At its best it lifts precision on the top-10% risk days from about 49% to 55–61% (base rate 31–33%). In practice that means **about 1 extra correct warning per 10 alerts**: modest.

It is **not** physiology. It is engagement withdrawal, and the generator puts it there through a shared latent motivation/stress process (G5/G7). What would be new to the owner, if it holds on real data:
- The intuitive "I'm logging later in the morning" signal is weak unless it is compared with the same weekday.
- Sleep cannot help as currently captured, because it is only typed in at the evening check-in. A one-tap morning sleep entry is the cheapest change that would add a well-documented predictor (G1).

### B6. Rerun on the owner's real data

`/api/sync/export` **is not enough**. It drops every timestamp (`completedAt`, `takenAt`, `eatenAt`, `createdAt`) and excludes `WorkoutSession`, `WorkoutSetLog` and `DailyScore`. Instead, connect to the Render Postgres instance with psql, using the external URL from the Render dashboard, and run the export below (`:uid` is the owner's `User.id`). Prisma stores `DateTime` as UTC `timestamp(3)`, so it is converted to local time:

```sql
\set tz '''Europe/Belgrade'''
\copy (SELECT "userId", date, day, bw, sleep, steps, top, notes, ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE :tz) AS "createdAt" FROM "DailyLog" WHERE "userId"=:'uid') TO 'daily_log.csv' CSV HEADER
\copy (SELECT id, "userId", date, "programDayName", ("startedAt" AT TIME ZONE 'UTC' AT TIME ZONE :tz) AS "startedAt", ("endedAt" AT TIME ZONE 'UTC' AT TIME ZONE :tz) AS "endedAt", "durationSeconds" FROM "WorkoutSession" WHERE "userId"=:'uid') TO 'workout_session.csv' CSV HEADER
\copy (SELECT "userId", "sessionId", "exerciseName", "setNumber", "weightKg", reps, ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE :tz) AS "createdAt" FROM "WorkoutSetLog" WHERE "userId"=:'uid') TO 'workout_set_log.csv' CSV HEADER
\copy (SELECT "userId", "blockId", date, "isComplete", ("completedAt" AT TIME ZONE 'UTC' AT TIME ZONE :tz) AS "completedAt" FROM "Completion" WHERE "userId"=:'uid' AND "isComplete") TO 'completion.csv' CSV HEADER
\copy (SELECT "userId", "supplementId", date, "isTaken", ("takenAt" AT TIME ZONE 'UTC' AT TIME ZONE :tz) AS "takenAt" FROM "SupplementLog" WHERE "userId"=:'uid' AND "isTaken") TO 'supplement_log.csv' CSV HEADER
\copy (SELECT ml."userId", ml."mealTemplateId", ml.date, ml."isEaten", (ml."eatenAt" AT TIME ZONE 'UTC' AT TIME ZONE :tz) AS "eatenAt", SUM(CASE WHEN lower(t.label) LIKE '%protein%' OR lower(t.label)='p' THEN NULLIF(regexp_replace(t.value,'[^0-9.]','','g'),'')::numeric * COALESCE(NULLIF(mt.grams,0)/100.0,1) END) AS protein, SUM(CASE WHEN lower(t.label) LIKE '%cal%' OR lower(t.label)='kcal' THEN NULLIF(regexp_replace(t.value,'[^0-9.]','','g'),'')::numeric * COALESCE(NULLIF(mt.grams,0)/100.0,1) END) AS calories FROM "MealLog" ml JOIN "MealTemplate" mt ON mt.id=ml."mealTemplateId" LEFT JOIN "MealTemplateTag" t ON t."mealTemplateId"=mt.id WHERE ml."userId"=:'uid' AND ml."isEaten" GROUP BY 1,2,3,4,5) TO 'meal_log.csv' CSV HEADER
\copy (SELECT * FROM "DailyScore" WHERE "userId"=:'uid') TO 'daily_score.csv' CSV HEADER
```

Then create `user_preferences.csv` by hand, because the app does not store these fields:
`userId,timezone,proteinTarget,kcalTarget,plannedDays` → e.g. `<uid>,Europe/Belgrade,150 g/day,2600,0,1,3,4` (`plannedDays`: Monday = 0). Run:

```
pip install -r docs/audit/scripts/requirements.txt
python docs/audit/scripts/analyze.py --data <export_dir> --split-date <date at ~60% of history> --am-supps <Supplement.id list with timeAt < 12:00>
```

Do not run `diagnostics.py` on real data; it needs `_truth.csv`.

**Data caveats for real data:**
- Deleting a schedule block, supplement or meal template **cascade-deletes its history** (`onDelete: Cascade`).
- Meal templates are per **weekday** and not snapshotted, so editing macros rewrites past protein in the join. For history, prefer `DailyScore.protein`.
- Untick-then-retick overwrites the timestamp.
- Workouts done without the app look like misses (14–17% of misses in simulation).
- A single user gives about 150–250 planned days per year. Expect confidence intervals about 4× wider than here; aim for at least 9–12 months before trusting a single-feature ranking, and treat anything with ΔAUC < 0.03 as noise.

### Files

- `docs/audit/scripts/score_audit.py`: port of the score, streak and badge logic; counter-examples; edge cases E1–E7.
- `docs/audit/scripts/simulate.py`: the generator (G1–G7).
- `docs/audit/scripts/features.py`: builds the panel from tables; leakage-safe lead datasets.
- `docs/audit/scripts/analyze.py`: baselines, models, single-feature table; writes `results.json`.
- `docs/audit/scripts/diagnostics.py`: label noise, ceiling, score validity, anatomy of streak breaks, proposed score.
- Raw outputs: scratch dir `…/scratchpad/score/` (`score_audit_output.txt`, `analyze_output.txt`, `analyze_s11.txt`, `analyze_s23.txt`, `diagnostics_output.txt`, `results*.json`).
