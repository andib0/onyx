# Onyx Daily Tracker — Feature Improvements Plan

## Overview
5 feature improvements. Phases 1-10 of the original refactoring plan are all ✅ DONE.

> **Rule**: No spread/rest operators on frontend (ESLint enforced). All use `Object.assign()`.

---

## Feature 1 — Topbar Cleanup
*Remove duplicate logout/email (already in sidebar), clean up the topbar*

### Modify: `src/components/layout/Topbar.tsx`
- Remove `userEmail` and `onLogout` from `TopbarProps` type
- Remove the `{userEmail && onLogout && (...)}` JSX block (lines 46-53)
- Keep: title, subtitle, TimelineFilter, Focus, Export, Import buttons

### Modify: `src/App.tsx`
- Remove `userEmail` and `onLogout` props from the `<Topbar>` JSX (find where these are passed)

### Modify: `src/styles/components.css`
- Remove `.user-email` and `.logout-btn` CSS rules (if they exist)

---

## Feature 2 — Database Libraries
**No changes needed.** All libraries (food, supplement, program) already use our own PostgreSQL database with seed data. Confirmed during exploration.

---

## Feature 3 — Nutrition: Edit Button + Grams-Based Macros
*Add an edit toggle to hide the grams input by default. Show calculated macros per actual grams.*

### Current state
- `MealCard.tsx` already has grams input visible whenever `meal.foodId` exists
- `updateMealGrams` API already recalculates tags (protein/carbs/calories) based on grams on the backend
- Tags are stored as `{label: "Protein", value: "25"}` (per 100g values currently)

### Modify: `src/views/NutritionView/MealCard.tsx`
- Add `isEditing` state (`useState(false)`)
- Show an **Edit** button (pencil icon or text) next to the meal name when `meal.foodId` exists
- When `isEditing` is true: show the grams input row (existing code)
- When `isEditing` is false: hide the grams input row
- Below the name, show a compact summary line: `"{grams}g · {protein}g P · {carbs}g C · {calories} kcal"` calculated from tags
  - Tags already contain per-100g values. Calculate displayed values: `Math.round(parseFloat(tag.value) * (grams / 100))`
  - This is purely a display calculation — the backend already stores the base per-100g values in tags

### Modify: `src/styles/components.css`
- Add `.mealEditBtn` styling (small, subtle button)
- Add `.mealMacrosSummary` styling (compact inline text below meal name)

---

## Feature 4 — Program: Unified Timer + Exercises Up Top
*Single timer switching between session (blue wave) and rest (green wave). Auto-start rest on exercise Rest button click. Exercises card moved above warm-up card.*

### Modify: `src/views/ProgramView/index.tsx`
- Add `timerMode` state: `'session' | 'rest'` (default `'session'`)
- On `startRest(programRow)`: set `timerMode = 'rest'` and auto-start the rest countdown
- When rest countdown hits 0: auto-switch `timerMode` back to `'session'`
- Reorder JSX: Move the `<MovementList>` card **above** the warm-up card
- Pass `timerMode` to `SessionCard`

### Modify: `src/views/ProgramView/SessionCard.tsx`
- Accept new prop `timerMode: 'session' | 'rest'`
- Replace the two-timer `timerRow` layout with a **single unified timer**:
  - When `timerMode === 'session'`: show session timer (count up), blue wave background via `::after` pseudo-element
  - When `timerMode === 'rest'`: show rest timer (countdown), green wave background
- Single set of Start/Pause + Reset buttons that control whichever timer is active
- Add a small mode indicator label ("Session" / "Rest — {exerciseName}")
- Remove the old `timerBlock` dual layout

### Modify: `src/styles/components.css`
- Add `.sessionCardWave` base class with `::after` for the wave animation
- `.sessionCardWave.sessionMode::after` — blue-ish gradient wave (use existing `wave` keyframes + app accent colors)
- `.sessionCardWave.restMode::after` — green-ish gradient wave
- Style the unified timer display (centered, larger font)
- Remove old `.timerRow`, `.timerBlock` CSS

---

## Feature 5 — Focus: Always Show All Three Sections
*Program exercises, nutrition meals, and supplements always visible regardless of time.*

### Current state
- `FocusView` uses `useActiveContext` which filters blocks by current time
- Only shows blocks that are currently active or upcoming
- `GymFocus`, `MealFocus`, `SupplementFocus` are thin wrappers around schedule blocks

### New file: `src/views/FocusView/ProgramFocusSection.tsx`
- Receives `programRows` and `programDayLabel` and `trainingDayActive` as props
- Renders a compact exercise list (exercise name, sets × reps, rest) in a `focusPanel` section
- If rest day: show "Rest day" message

### New file: `src/views/FocusView/NutritionFocusSection.tsx`
- Receives `mealTemplates` for current day and `mealCheckMap` (Record<string, boolean>)
- Renders a compact meal checklist in a `focusPanel` section
- Each meal shows name + taken/not-taken status
- Clicking toggles the taken state (reuse `onToggleMealTaken` callback)

### Modify: `src/views/FocusView/index.tsx`
- Add new props: `programRows`, `programDayLabel`, `trainingDayActive`, `mealTemplates`, `mealCheckMap`, `onToggleMealTaken`
- Always render three persistent sections at the bottom of `focusStack`:
  1. `<ProgramFocusSection>` — today's exercises
  2. `<NutritionFocusSection>` — today's meals with check status
  3. `<SupplementFocus>` — always show (not gated by `supplementWindow` anymore)
- Keep the existing time-based `focusBlocks` at the top as "active now" context
- The supplement section: pass all supplements (not just horizon-filtered), show all with checked/unchecked state

### Modify: `src/App.tsx`
- Pass additional props to `<FocusView>`:
  - `programRows={program.programRows}`
  - `programDayLabel={program.programDayLabel}`
  - `trainingDayActive={program.trainingDayActive}`
  - `mealTemplates={meals.mealTemplatesForSelectedDay}` (or equivalent for today)
  - `mealCheckMap={meals.mealCheckMap}` (or equivalent)
  - `onToggleMealTaken={meals.toggleMealTaken}` (or equivalent)

### Modify: `src/styles/components.css`
- Add `.focusSectionDivider` — subtle separator between time-based and persistent sections
- Add `.focusCompactList` — compact list styling for exercises and meals
- Add `.focusCheckItem` — checkable item with taken/pending state

---

## Verification
After each feature:
1. `npx eslint src/` — zero errors
2. `npx tsc --noEmit` — zero errors
3. `npm run build` — successful Vite build
4. Manual test in browser: topbar clean, grams edit works, timer switches modes, focus shows all sections
