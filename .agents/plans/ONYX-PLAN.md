# ONYX Daily Tracker - Architecture Plan

## Overview

Onyx is a daily productivity/health tracker with a React web frontend, React Native mobile app, and Express/Prisma/PostgreSQL backend.

---

## Mobile App Architecture (Expo 54 / React Native 0.81.5)

### Stack
- **Framework**: Expo SDK 54 + Expo Router 6 (file-based routing)
- **React**: 19.1.0 + React Native 0.81.5
- **TypeScript**: 5.9 (strict: true)
- **Storage**: AsyncStorage (app state), expo-secure-store (auth tokens)
- **Tooling**: ESLint 9, Prettier, tsc --noEmit

### Project Structure
```
mobile/
  app/
    _layout.tsx          # Root layout: GestureHandler > SafeArea > Auth > AppState > ErrorBoundary
    index.tsx            # Entry redirect
    +not-found.tsx       # 404 handler
    log.tsx              # Log entries screen
    supplements.tsx      # Supplements management screen
    (auth)/
      _layout.tsx        # Auth group layout
      login.tsx
      register.tsx
    (tabs)/
      _layout.tsx        # Tab navigator (Today, Nutrition, Focus, Program, More)
      today.tsx           # Schedule timeline + block CRUD
      nutrition.tsx       # Meal templates, food search, macros
      focus.tsx           # Active block panel, workout timer, checklists
      program.tsx         # Gym program browser + day selector
      more.tsx            # Import/export, log nav, supplements nav, logout
  api/
    client.ts            # HTTP client (env-based URL via expo-constants)
    auth.ts              # Login, register, refresh, logout
    foods.ts             # Food database search
    logs.ts              # Log entries CRUD
    meals.ts             # Meal template CRUD by day
    preferences.ts       # User preferences API
    programs.ts          # Program listing + detail
    schedule.ts          # Schedule block CRUD
    supplements.ts       # Supplement CRUD + daily checks
    supplementDb.ts      # Supplement database search
    sync.ts              # Full app state import/export
    userFoods.ts         # User saved foods CRUD
  contexts/
    AppStateContext.tsx   # Composed provider tree + useAppState() backward-compat shim
    AuthContext.tsx       # JWT auth (SecureStore tokens, auto-refresh)
    DataContext.tsx       # App state loading, import/export, log, meta/nutrition targets
    MealsContext.tsx      # Meal templates, day selection, meal checks
    ProgramContext.tsx    # Gym programs, workout timer state
    ScheduleContext.tsx   # Schedule blocks + completion tracking
    SupplementsContext.tsx # Supplements list + daily checks
    TimelineContext.tsx   # Computed timeline (depends on schedule + supplements + program + meals)
    ToastContext.tsx      # Toast notifications (renders <Toast> once at provider level)
  hooks/
    useActiveContext.ts   # Focus screen: active blocks, next block, supplement window
    useCompletion.ts     # Block completion state (completionByBlockId, CRUD)
    useDebouncedValue.ts # Generic debounce hook
    useImportExport.ts   # Import/export app state JSON
    useLog.ts            # Log entry CRUD
    useMeals.ts          # Meal template CRUD, day options, check map
    useNow.ts            # Single nowMinutes source (60s interval)
    useProgram.ts        # Program selection, detail fetch, computed rows/label
    useSupplements.ts    # Supplement CRUD, daily checks
    useToast.ts          # Toast message + visibility state
    useToday.ts          # Visible blocks, next start block
    useWorkout.ts        # Workout timer: work/rest intervals, exercise progression
  components/
    focus/
      FocusBlockPanel.tsx   # Active/upcoming block with progress bar
      TimelineSummary.tsx   # Done/Left/Next pills + progress bar
      WorkoutSection.tsx    # Workout states: idle, active (timer+controls), finished
    layout/
      Header.tsx            # App header
      ScreenContainer.tsx   # Safe area scroll wrapper
    nutrition/
      FoodSearchSection.tsx # Food database search + results
      MealCard.tsx          # Meal template card with checkbox, grams, macros
      MyFoodsSection.tsx    # User's saved foods list
    schedule/
      BlockForm.tsx         # Add/edit schedule block form (unified)
      BlockItem.tsx         # Single schedule block row
    shared/
      Checkbox.tsx          # Accessible checkbox with label
      ChecklistSection.tsx  # Generic checklist card (meals/supplements in focus)
      ChipSelector.tsx      # Horizontal chip/tag selector with optional getColor
      ErrorBoundary.tsx     # Class-based React error boundary
      LoadingScreen.tsx     # Centered ActivityIndicator
    ui/
      Card.tsx              # Card container with optional title
      ConfirmModal.tsx      # Confirmation dialog modal
      Pill.tsx              # Small info pill
      ProgressBar.tsx       # Animated progress bar
      Toast.tsx             # Toast notification component
  types/
    appTypes.ts           # All app domain types (ScheduleBlock, MealTemplate, etc.)
    apiTypes.ts           # API response shapes (ApiScheduleBlock, ApiMealTemplate, etc.)
  utils/
    formatting.ts         # Date/string formatting
    normalize.ts          # App state normalization (ensureState)
    nutrition.ts          # buildNutritionTargets(), getGoalLabel(), foodToMealTemplate()
    storage.ts            # todayKey(), ensureState(), clearStorage()
    time.ts               # toMinutes(), getCurrentNextBlocks(), time utilities
  data/
    weekdayData.ts        # META defaults only (timezone, caffeine cutoff, sleep/protein/hydration targets)
  theme/
    index.ts              # colors, spacing, radii, fontSizes, fonts
    sharedStyles.ts       # pressed, emptyText, formInput, formLabel, formField
```

### Provider Nesting Order
```
GestureHandlerRootView
  SafeAreaProvider
    AuthProvider
      AppStateProvider
        ToastProvider
          ProgramProvider (auth user)
            DataProviderBridge (resetProgram, programGoal)
              DataProvider (loads appState)
                DomainProviders
                  ScheduleProvider (appState)
                  MealsProvider (appState)
                  SupplementsProvider (appState)
                    InnerProviders
                      TimelineProvider (schedule + supplements + meals + program)
        ErrorBoundary
          StatusBar
          RootContent (Slot)
```

### Domain Context Responsibilities

| Context | State Owned | Key Methods |
|---------|------------|-------------|
| **Toast** | toastMessage, toastVisible | showToast() |
| **Data** | appState, stateLoading, logEntries | addLogEntry, import/export, nutritionTargets, meta |
| **Program** | programs, selectedProgramId, workout | handleSelectProgram, start/pause/stop/skip workout |
| **Schedule** | scheduleBlocks, completionByBlockId | setBlockCompletion, add/update/remove block |
| **Meals** | selectedMealDay, mealCheckMap | setMealChecked, add/update/remove template |
| **Supplements** | supplementsList, supplementChecks | setSupplementChecked, add/update/remove supplement |
| **Timeline** | timelineBlocks, visibleBlocks, showAll | computed from schedule + supplements + meals + program |

### Key Conventions
- **No spread/rest operators** — ESLint enforced, use `Object.assign()`
- **Prettier**: semi: true, singleQuote: false, printWidth: 90, trailingComma: "es5"
- **Single timer source**: `useNow()` provides `nowMinutes`; consumed by `useActiveContext` and `useToday`
- **Toast centralized**: `ToastProvider` renders `<Toast>` once; screens call `useToastContext().showToast()`
- **Backward-compat shim**: `useAppState()` merges all domain contexts; used by `supplements.tsx` and `log.tsx`

---

## Web Frontend Architecture (React 19 + Vite 7)

See `080226-frontend-plan.md` for detailed session logs.

### Key Facts
- Composition root: `App.tsx` (~445 lines)
- Custom hooks: useProgram, useMeals, useImportExport, useCompletion, useLog, useSupplements, useToday, useToast
- Utils: `src/utils/normalize.ts`, `src/utils/nutrition.ts`, `src/constants.ts`
- ErrorBoundary wraps each view
- Same no-spread/rest rule enforced

---

## Backend Architecture (Express 4.21 + Prisma 5.22)

See `080226-backend-plan.md` for detailed session logs.

### Key Facts
- PostgreSQL with 15 Prisma models
- JWT access tokens + httpOnly refresh cookies (+ body token for mobile)
- Zod validation middleware on all routes
- AppError + handleServiceError pattern
- 11 route groups: auth, users, programs, schedule, meals, supplements, foods, userFoods, logs, supplementDb, sync
- Seed data: foods (3000+), supplements (100+), programs (5)

---

## Changelog

### Mobile Refactor (Feb 2026)
**Phase 1 - Tooling**: Added .prettierrc, ESLint config, npm scripts (lint/format/typecheck), formatted entire codebase
**Phase 2 - Types**: Consolidated all types into `types/appTypes.ts` and `types/apiTypes.ts`, eliminated inline definitions
**Phase 3 - Shared Components**: Adopted Checkbox + ChipSelector (previously unused), created LoadingScreen, ChecklistSection, BlockForm, sharedStyles.ts
**Phase 4 - Context Split**: Split monolithic AppStateContext into 7 domain contexts (Toast, Data, Program, Schedule, Meals, Supplements, Timeline), created useNow() single timer, backward-compat useAppState() shim
**Phase 5 - Screen Decomposition**: focus.tsx 834->274 lines, nutrition.tsx 689->355, program.tsx 278->207, today.tsx decomposed into BlockItem+BlockForm. Extracted FocusBlockPanel, WorkoutSection, TimelineSummary, MealCard, FoodSearchSection, MyFoodsSection
**Phase 6 - Cleanup**: Stripped weekdayData.ts to meta-only (735->22 lines), cleaned storage.ts (removed 5 dead functions), removed unused useCompletion returns, removed all screen-level Toast components
**Phase 7 - Verification**: TypeScript clean, ESLint clean, Prettier clean, removed invalid eslint-disable comments for nonexistent rules
