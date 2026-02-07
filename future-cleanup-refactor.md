# Future Cleanup and Refactor Review CODEX (2026-02-07)

## Summary

Full scan of frontend, backend, and planning docs. The project is in good shape overall, but there are several correctness and data integrity issues worth addressing first. The highest priority fixes are related to offline-first behavior, sync import/export data loss, and progress calculations that include non-completable blocks.

## Findings (highest priority first)

1. [High] Offline-first fallback is effectively disabled. `src/App.tsx` loads state only from the backend via `exportUserData()` and resets to an empty state on failure. `src/hooks/useLocalStorage.ts` and `src/utils/storage.ts` are not used for hydration. Impact: if the API is down or the user is offline, the UI comes up empty and can appear to lose data. Fix: hydrate from local cache first, then reconcile with backend; avoid resetting state on fetch failure; show an offline banner; persist state changes locally for offline continuity. Files: `src/App.tsx`, `src/hooks/useLocalStorage.ts`, `src/utils/storage.ts`.
2. [High] Sync import/export loses nutrition grams and food linkage. `backend/src/services/sync.service.ts` does not import or export `mealTemplates.grams` or `mealTemplates.foodId`. This breaks grams-based recalculation and loses data on import/export. Fix: include `grams` and `foodId` in both export and import paths; update schema validation in `backend/src/validators/sync.schema.ts` accordingly; update client normalization if needed. Files: `backend/src/services/sync.service.ts`, `backend/src/validators/sync.schema.ts`, `src/views/NutritionView/MealCard.tsx`.
3. [High] Timeline progress counts blocks that can never be completed. `timelineProgressPercent` and remaining counts in `src/App.tsx` use all `timelineBlocks` (schedule + program + nutrition + supplements). Completion only exists for schedule blocks, so progress is permanently undercounted. Fix: compute progress from schedule blocks only, or from blocks where `source === 'schedule'` and `readonly !== true`. Files: `src/App.tsx`, `src/hooks/useCompletion.ts`.
4. [High] Focus view uses unsorted schedule blocks for next-block logic. After adding blocks, `appState.schedule` appends items and is no longer ordered by time. `useActiveContext` relies on array order for `nextBlock`, so it can point to the wrong block. Fix: sort schedule blocks by `start` in `useActiveContext`, or pass the already-sorted `timelineBlocks` into focus logic. Files: `src/hooks/useActiveContext.ts`, `src/views/FocusView/index.tsx`.

## Medium priority

1. [Medium] Macro summary double-scales values. Backend `updateGrams` writes tags as totals for the current grams, but `src/views/NutritionView/MealCard.tsx` uses `computeMacro(tag.value, grams)`, which scales again. This yields incorrect macro totals for non-100g servings. Fix: either store per-100g tags and scale in UI, or store total tags and display directly. Files: `backend/src/services/meals.service.ts`, `src/views/NutritionView/MealCard.tsx`.
2. [Medium] Sync export/import ignores `top3`, `mechanism`, and `supp`. These keys exist in `AppState` but are always empty in export and not persisted in import. Fix: either remove these keys from state/types or implement persistence in sync. Files: `src/types/appTypes.ts`, `backend/src/services/sync.service.ts`.
3. [Medium] API client assumes JSON responses. `apiClient` always calls `response.json()` and returns a generic error if parsing fails. This hides real error bodies and can throw on 204 responses. Fix: check `content-type` and handle empty bodies gracefully. File: `src/api/client.ts`.
4. [Medium] Failed initial data load silently wipes UI state. On `exportUserData()` failure, `src/App.tsx` sets a fresh empty state without user-facing feedback. Fix: keep previous state, show toast, and/or fall back to cached local state. File: `src/App.tsx`.

## Low priority / UX polish

1. [Low] Focus view renders supplements twice (upcoming window and full list). It is visually noisy and potentially redundant. Consider separating into a single section with filters or toggles. File: `src/views/FocusView/index.tsx`.
2. [Low] Schedule edit allows invalid time ranges. `Timeline.saveEdit()` does not validate that `start < end`, which can create zero or negative blocks. Fix: add validation and a toast. File: `src/views/TodayView/Timeline.tsx`.
3. [Low] Preferences sync lacks error handling and may fire frequently. `useProgram` pushes preferences on every state change without catching failures. Fix: debounce or add optimistic UI with retry on failure. File: `src/hooks/useProgram.ts`.

## Documentation alignment

1. `README.md` and `AGENTS.md` still emphasize offline-first localStorage as the primary persistence mechanism, but the application now uses backend sync as the source of truth. Update docs to match current architecture and describe the offline fallback plan. Files: `README.md`, `AGENTS.md`, `Implementing.md`.

## Suggested refactor candidates (optional)

1. Centralize state hydration and persistence into a single hook (backend fetch + local cache + offline detection) to eliminate repeated patterns and prevent accidental resets. Files: `src/App.tsx`, `src/hooks/useLocalStorage.ts`.
2. Create a small `normalizeAppState()` contract that is shared between backend export and frontend normalization so fields do not drift (especially meals and logs). Files: `backend/src/services/sync.service.ts`, `src/utils/normalize.ts`.
3. Consider a type-shared schema (Zod in frontend + backend) for `AppState` and API payloads to prevent silent data loss on future migrations.
