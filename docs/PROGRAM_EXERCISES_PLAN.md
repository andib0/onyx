# Program & Exercises — Detailed Overhaul Plan

Synthesises every gym-related thread in this project: per-set logging, "beat last
session", PR detection, the set-done/rest flow, custom programs, and the Hevy/
Strong references from the UI plan. Goal: make Program the place you *plan and
understand* training, and make the exercise the first-class object it deserves to
be (it currently has no identity beyond a row of text).

---

## 0. Problem statement

Today:
- An exercise is a flat `ProgramRow` (`ex, sets, reps, rir, rest, notes, prog`)
  rendered as a static text row. No history, no progression UI, no detail view.
- The Program tab shows the day's exercise list read-only; all logging happens in
  the Focus workout flow. The two never visually connect — you can't see "what I
  did last time" while *planning*, only while lifting.
- WorkoutSetLog already stores every set (weight×reps×rir per session) but that
  data surfaces only as a one-line "Last: 60kg — 8/8/7" during the workout. It's
  never charted, never drives a suggestion.
- Exercise names are free strings → "Bench Press" ≠ "Bench press" silently splits
  history. No canonical exercise concept.

---

## 1. The Exercise as a first-class object

### 1.1 Exercise detail screen (`/exercise/[name]`)
Tap any exercise (in program list, session card, or active workout) → detail:
- **Header**: name, muscle group (if known), target sets×reps×RIR from the program.
- **History list**: every past session of this exercise — date, all sets
  `82.5×8, 82.5×8, 80×7`, session volume (Σ weight×reps), and est. 1RM (Epley).
- **Charts** (svg, reuse BarChart / area):
  - Top-set weight over time (line/area) — the strength trend.
  - Volume per session (bars) — the work trend.
  - Best est-1RM marker.
- **Notes & cues**: the program's `notes` + `progression` string, editable.
- Entry points: program session row, idle preview row, active-workout exercise
  name, set-pill long-press.

Backend: `GET /workouts/exercise-history` already returns last-session sets; extend
to `GET /workouts/exercise/:name/history?limit=20` returning all sessions' sets for
the charts. Cheap — same table, wider query.

### 1.2 Canonical exercise names
- Seed a reference `ExerciseLibrary` (name, aliases, primaryMuscle, equipment).
- Program editor exercise field → autocomplete from the library (free text still
  allowed, but suggestions prevent "Bench Press"/"Bench press" splits).
- Normalise on write (trim, case-fold for the history key; preserve display case).
  Fixes the PR/history-splitting data bug.

---

## 2. Progression engine (the payoff of all the logging)

Double-progression is the program's stated method but nothing computes it. With
WorkoutSetLog we can:

- **Suggested next target** per exercise: if last session hit top of the rep range
  on all sets at a given weight → suggest +2.5kg (upper) / +1.25kg (isolation) and
  reset to bottom of range; else repeat weight, aim +1 rep. Show as a chip on the
  exercise: "Try 85kg today" with a one-tap accept that prefills the workout.
- **Plateau flag**: 3 sessions no progress on an exercise → gentle "stalled —
  consider a deload or rep-range change" note. Ethical, non-nagging.
- Surface suggestions in two places: the program session card (planning) and the
  active-workout lifting card prefill (doing).

---

## 3. Program tab redesign (planning surface)

Current session card is a decent read-only list. Upgrade:

### 3.1 Session card → interactive
Each exercise row becomes tappable (→ detail) and shows a **mini last-session
chip**: `last 82.5×8/8/7` in mono, plus the suggested target chip when available.
Row layout:
```
1  Bench Press                    3×8–10
   last 82.5 · 8/8/7   → try 85kg
```

### 3.2 Week overview
A horizontal strip of the program's days (Push/Pull/Legs…) with a done-dot per day
this week (from WorkoutSession dates). Shows training consistency at a glance —
the Program-tab analogue of the Focus day-score.

### 3.3 Volume summary
Small card: this week's total sets and volume per muscle group (from logged sets +
library muscle mapping). Answers "am I hitting everything?" — the question serious
lifters actually have. Uses BarChart (sets per muscle group).

---

## 4. Program editor upgrades

- Exercise field autocomplete (1.2).
- Reorder exercises (drag handle, or up/down chevrons — simpler, Expo-safe).
- Per-exercise rest as a stepper (currently free text "90s").
- Duplicate-day action (build Push, "duplicate as Pull", edit).
- Superset grouping (later — tag rows A1/A2). Out of scope v1.

---

## 5. Active workout ↔ program coherence

- Active lifting card shows the same suggested-target chip; accepting it prefills
  weight.
- After finishing, the session card on Program immediately reflects new "last"
  values + recomputed suggestions (already same data source; ensure refresh).
- "Beat last session" framing: during a set, if current entry ≥ last session's
  matching set, subtle ✓; if it would be a PR, the existing flame.

---

## 6. Data / backend changes

| Need | Change |
|---|---|
| Full exercise history | `GET /workouts/exercise/:name/history` (all sessions) |
| Canonical names | `ExerciseLibrary` table + seed; normalise key on set log write |
| Muscle mapping for volume | `primaryMuscle` on library; join in a volume endpoint |
| Suggestion (client-side first) | compute from history in a `utils/progression.ts`; promote to backend only if needed |

No schema break — all additive.

---

## 7. Execution order (phased)

1. **Exercise detail screen** + full-history endpoint + history charts. (biggest
   single value — turns logged data into insight)
2. **Progression util** + suggested-target chips on session card and lifting card.
3. **Program session card interactive** (last chip, tap-through, week strip).
4. **Exercise library** + autocomplete + name normalisation (data-integrity).
5. **Volume-per-muscle** summary card.
6. Editor upgrades (reorder, rest stepper, duplicate day).

Phase 1–2 deliver the "massive overhaul" feel; 4 fixes the silent data bug; 3/5
are polish/insight; 6 is editor quality-of-life.

---

## 8. Guardrails
- All charts reuse existing svg primitives (BarChart, area path) — no new deps.
- Suggestions are advisory, never auto-change the program.
- Exercise history keyed on normalised name; display preserves user casing.
- Reduce-motion respected on any new animation.
