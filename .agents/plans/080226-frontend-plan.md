# Frontend Plan - 08/02/26

## Features Developed
- [x] Initial ONYX-PLAN.md created with full frontend documentation
- [x] Dynamic nutrition targets based on user weight + gym program goal
- [x] Dynamic sidebar: nutrition nav shows goal label + user weight instead of hardcoded values
- [x] Auto-advancing workout flow in Focus view (60s work, 30s rest, pause/skip/stop)
- [x] Single exercise card in Focus (replaces full exercise list)
- [x] Timer moved from ProgramView to Focus view
- [x] Completed exercises shown in green on ProgramView table

## Components/Endpoints Created
- `src/utils/nutrition.ts` - `buildNutritionTargets()` computes targets from user weight + program goal; `getGoalLabel()` returns human-readable goal name
- `src/hooks/useWorkout.ts` - Auto-advancing workout hook: manages work/rest intervals, set counting, exercise progression, completion tracking

## Files Modified
- `src/App.tsx` - imports `buildNutritionTargets` + `useWorkout`, computes nutritionTargets/programGoal, passes workout state to FocusView, completedExercises to ProgramView, programGoal/userWeight to Sidebar
- `src/views/NutritionView/index.tsx` - new `programGoal` prop, dynamic card heading via `getGoalLabel()`
- `src/components/layout/Sidebar.tsx` - new `programGoal`/`userWeight` props, dynamic goal label + weight display
- `src/views/FocusView/index.tsx` - new workout props (workout, onStartWorkout, onTogglePauseWorkout, onStopWorkout, onSkipWorkoutInterval), passes to ProgramFocusSection
- `src/views/FocusView/ProgramFocusSection.tsx` - complete rewrite with workout timer, single exercise card, exercise list with done/current state
- `src/views/ProgramView/index.tsx` - removed all timer state + SessionCard, added completedExercises prop
- `src/views/ProgramView/MovementList.tsx` - removed Rest button + onStartRest, added completedExercises + green row styling
- `src/styles/components.css` - added workout flow CSS classes

## Files Deprecated
- `src/views/ProgramView/SessionCard.tsx` - no longer imported (timer functionality moved to Focus view)

## Issues Encountered & Resolved
- **Issue:** ESLint flagged unused `getGoalLabel` import in App.tsx (only needed in NutritionView)
  **Resolution:** Removed import from App.tsx, kept only in NutritionView where it's used
- **Issue:** ESLint `react-hooks/refs` flagged `rowsRef.current = programRows` in useWorkout render body
  **Resolution:** Replaced ref approach with primitive-derived values (`currentRowSets`, `rowCount`) for effect dependencies
- **Issue:** ESLint `react-hooks/set-state-in-effect` flagged setState calls in interval completion effect
  **Resolution:** Added inline eslint-disable comment (legitimate timer state transition pattern, same as other hooks in codebase)

## Pending Tasks
- [ ] Clean up unused SessionCard.tsx file
- [ ] Consider adding sound/vibration notification when rest timer ends
- [ ] Review ONYX-PLAN.md for accuracy and completeness

## Session Context
- Full codebase scan performed to establish baseline documentation
- All frontend files read and analyzed: 65+ source files across api/, hooks/, views/, components/, utils/
- Architecture patterns documented: composition root, custom hooks, Object.assign convention, ensureState pattern
- Nutrition targets were previously hardcoded in `DATA.nutritionTargets` (weekdayData.ts) with fixed values like "72 -> 75 kg"
- Now computed dynamically from `user.weight`, `user.preferences`, and `program.programDetail.goal`
- 5 goal profiles: bulk, cut, recomp, strength, general - each with specific macro multipliers
- Fallback: when no weight set, shows preference-based targets + hint to set weight
- Sidebar "Lean bulk" and "72-75" were hardcoded in navItems array - now derived from programGoal + userWeight
- Timer was in ProgramView (reference/configuration view) - moved to Focus (active workout context)
- ProgramFocusSection showed all exercises as compact list - now shows single exercise card with auto-advancing timer
- useWorkout hook manages: isActive, isPaused, mode (work/rest), exerciseIndex, currentSet, secondsRemaining, completedExercises, isFinished
- completedExercises Set shared between Focus and Program views via App.tsx

## ONYX-PLAN.md Updates
- [x] Initial creation with complete frontend section
- [x] Added `nutrition.ts` to folder structure in architecture section
- [x] Added changelog entry for dynamic nutrition targets
- [x] Added `useWorkout.ts` to folder structure in architecture section
- [x] Added changelog entry for workout flow + focus timer + sidebar fixes
