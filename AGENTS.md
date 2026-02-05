# AGENTS.md

## Project Overview

Onyx is a focused, offline-first daily operating system for training, nutrition, and personal execution. Built as a single-page React application using Vite, it prioritizes speed, simplicity, and data ownership through client-side localStorage persistence.

## Core Technology Stack

### Primary Stack

- **React** 19 (latest stable)
- **Vite** 5+ (build tool and dev server)
- **TypeScript** (strict)
- **CSS** Modern CSS with CSS custom properties (no CSS-in-JS, no preprocessors)

### Development Tools

- **ESLint** 9+ with React hooks + TS support
- **Prettier** 3+ for code formatting
- **Vitest** for unit testing (future)
- **React Testing Library** for component testing (future)

### Recommended Additions

- **Zod** for runtime validation of localStorage data
- **date-fns** for date manipulation (replace custom time utils)
- **React Router** if multi-page navigation becomes necessary
- **Zustand** or **Jotai** if state management complexity grows

## Project Structure

```
onyx/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Pill.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── ViewContainer.tsx
│   │   └── shared/
│   │       ├── BlockItem.tsx
│   │       ├── TimelineFilter.tsx
│   │       └── CompletionToggle.tsx
│   ├── views/
│   │   ├── TodayView/
│   │   │   ├── index.tsx
│   │   │   ├── Timeline.tsx
│   │   │   └── QuickActions.tsx
│   │   ├── ProgramView/
│   │   │   ├── index.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   └── MovementList.tsx
│   │   ├── NutritionView/
│   │   │   ├── index.tsx
│   │   │   ├── MealCard.tsx
│   │   │   └── MacroBar.tsx
│   │   ├── SupplementsView/
│   │   │   ├── index.tsx
│   │   │   ├── SupplementCard.tsx
│   │   │   ├── SupplementForm.tsx
│   │   │   └── TierSection.tsx
│   │   └── LogView/
│   │       └── index.tsx
│   ├── hooks/
│   │   ├── useLocalStorage.ts
│   │   ├── useCompletion.ts
│   │   ├── useSupplements.ts
│   │   ├── useLog.ts
│   │   ├── useToday.ts
│   │   ├── useToast.ts
│   │   └── useImportExport.ts
│   ├── utils/
│   │   ├── storage.ts
│   │   ├── time.ts
│   │   └── formatting.ts
│   ├── data/
│   │   └── weekdayData.ts
│   ├── styles/
│   │   ├── app.css
│   │   ├── components.css
│   │   └── utilities.css
│   ├── types/
│   │   └── appTypes.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── eslint.config.js
├── tsconfig.json
├── vite.config.js
├── package.json
└── README.md
```

## Data Architecture

### Local Storage Schema (current)

Stored under key: `andi_weekday_os_v1`

```ts
{
  completion: { [YYYY-MM-DD]: { [blockId]: boolean } },
  top3: { [YYYY-MM-DD]: string },
  mechanism: { [YYYY-MM-DD]: string },
  schedule: Array<ScheduleBlock>,
  supp: { [id]: boolean },
  suppLog: { [YYYY-MM-DD]: { [id]: boolean } },
  mealTemplatesByDay: { [dayName]: Array<MealTemplate> },
  mealLog: { [YYYY-MM-DD]: { [mealId]: boolean } },
  supplementsList: Array<SupplementItem>,
  log: Array<LogEntry>
}
```

### Notes

- No versioning or migrations yet. The `normalizeState` function in `App.tsx` does minimal shape normalization.
- `SupplementItem` now uses a single `timeAt: "HH:MM"` field (exact time). The previous `timing/window` strings are removed.

## Code Standards

### ESLint Configuration (current)

- Flat config in `eslint.config.js`.
- TS files use `@typescript-eslint/parser` and `@typescript-eslint/no-unused-vars`.
- Spread/rest is disallowed for JS and TS.

### Prettier Configuration (current)

```json
{
  "semi": true,
  "singleQuote": false,
  "printWidth": 90,
  "trailingComma": "es5"
}
```

### File Naming Conventions

- **Components**: PascalCase (`TodayView.tsx`, `BlockItem.tsx`)
- **Utilities/Hooks**: camelCase (`useLocalStorage.ts`, `time.ts`)
- **Styles**: kebab-case (`app.css`, `components.css`)

### Component Guidelines

- **Max file length**: 200 lines (if possible) (extract sub-components or hooks)
- **Single Responsibility**: One primary concern per file
- **Prop drilling limit**: Max 2 levels (use context or state management after)
- **Custom hooks**: Extract stateful logic that's reused 2+ times
- **Pure utilities**: Functions without side effects go in `/utils`

### Import Order

1. React and external libraries
2. Internal hooks
3. Internal components
4. Utilities and data
5. Styles

## Refactoring Plan Status

### Phase 1: Extract Custom Hooks from App.jsx

Status: **Done** (migrated to TypeScript)

- `useLocalStorage` -> `src/hooks/useLocalStorage.ts`
- `useCompletion` -> `src/hooks/useCompletion.ts`
- `useSupplements` -> `src/hooks/useSupplements.ts`
- `useLog` -> `src/hooks/useLog.ts`
- `useToast` -> `src/hooks/useToast.ts`
- `useImportExport` -> `src/hooks/useImportExport.ts`

### Phase 2: Component Decomposition

Status: **Done**

- TodayView: `Timeline`, `QuickActions`, shared `BlockItem`
- SupplementsView: `SupplementCard`, `SupplementForm`, `TierSection`
- LogView: consolidated into `index.tsx`
- Shared: `CompletionToggle`, `TimelineFilter`

### Phase 3: Utility Consolidation

Status: **Partially done**

- `utils/formatting.ts` added
- `utils/validation.ts` not created
- `data/constants.ts` not created

### Phase 4: Style Reorganization

Status: **Done**

- `app.css` (global)
- `components.css` (component styles)
- `utilities.css` (layout helpers)

### Phase 5: Testing Infrastructure

Status: **Not started**

## State Management Strategy

### Current Approach

- Global state in `App.tsx` with prop drilling
- localStorage as single source of truth

## Performance Considerations

- Consider `React.memo` for heavy lists
- Consider debounced inputs for text fields
- Consider virtual scrolling for large log histories

## Accessibility Standards

- Color contrast ratio: 4.5:1 for text, 3:1 for large text
- Keyboard navigation: All interactive elements focusable
- Focus indicators: Visible focus rings
- ARIA labels: For icon-only buttons

## Commands

```bash
# Development
npm install           # Install dependencies
npm run dev           # Start dev server (http://localhost:5173)
npm run build         # Production build
npm run preview       # Preview production build

# Code Quality
npm run lint          # Run ESLint
npm run format        # Run Prettier
npm run format:write  # Apply Prettier formatting
npm run typecheck     # TypeScript typecheck
```

## Migration and Versioning (future)

When schema changes:

1. Add a `version` field in stored state
2. Create `/utils/migrations.ts`
3. Run migrations on app load in `useLocalStorage`

---

## Feature Improvement Roadmap

### 1. Focus Mode / Active Task View (Priority 1)

**Purpose**: Distraction-free, context-aware interface that auto-switches based on current activity

**Key Features**:
- Auto-switching context detection (gym, meal, supplement timing)
- Glanceable design with large typography and minimal chrome
- Visual progress indicators (progress bars showing time until next task)
- Ambient notifications with subtle countdown timers
- Stacked active blocks (and supplements due in the next 60 minutes)

**Technical Implementation**:
- Route: `/focus`
- Hook: `useActiveContext.ts` (determines display based on time + schedule)
- Components:
  - `FocusView/index.tsx` - Main container
  - `FocusView/GymFocus.tsx` - Active workout display
  - `FocusView/MealFocus.tsx` - Meal timing display
  - `FocusView/SupplementFocus.tsx` - Supplement reminder display
- Focus is the default entry route and appears as a left-side nav item
- Focus does not mark blocks complete (completion review happens in Today view)

**File Structure Addition**:
```
src/
├── views/
│   └── FocusView/
│       ├── index.tsx
│       ├── GymFocus.tsx
│       ├── MealFocus.tsx
│       └── SupplementFocus.tsx
├── hooks/
│   └── useActiveContext.ts
```

### 2. Unified Timer System (Priority 1)

**Purpose**: Fix gym program with intelligent state machine for workout progression

**Data Structure**:
```typescript
interface WorkoutSession {
  exercises: Array<Exercise>;
  currentExerciseIndex: number;
  currentSetIndex: number;
  phase: 'work' | 'rest' | 'transition' | 'complete';
  timer: {
    remaining: number;
    total: number;
  };
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restTime: number; // in seconds
  type: 'compound' | 'isolation'; // affects default rest time
}
```

**Key Features**:
- Auto-progression: Work → Rest → Next Set → Next Exercise
- Smart rest time defaults (compound: 180s, isolation: 60s)
- Optional voice feedback (text-to-speech)
- Day selector with visual calendar
- Session history showing last performance (weight, reps)
- Pause/resume functionality

**Components**:
```
src/
├── views/
│   └── ProgramView/
│       ├── ActiveWorkout.tsx
│       ├── ExerciseProgress.tsx
│       ├── WorkoutDaySelector.tsx
│       └── WorkoutTimer.tsx
├── hooks/
│   ├── useWorkoutSession.ts
│   └── useWorkoutTimer.ts
```

### 3. Nutrition View Enhancements (Priority 1)

**New Features**:
- Add meal button (bulk add from templates)
- Macro calculator showing daily totals vs targets
- Meal prep mode (multiply recipes by portions)
- Quick log (tap to mark eaten, no navigation required)
- Next meal countdown in header

**UI Fixes**:
- Standardize edit/remove button widths using CSS Grid
- Add drag-to-reorder functionality for meals
- Consistent spacing and alignment

**CSS Utility Addition**:
```css
.btn-actions {
  display: grid;
  grid-template-columns: auto auto;
  gap: 8px;
}
```

**Components**:
```
src/
├── views/
│   └── NutritionView/
│       ├── MacroCalculator.tsx
│       ├── MealTemplateSelector.tsx
│       └── QuickMealLog.tsx
├── hooks/
│   └── useMacroTracking.ts
```

### 4. Log View Upgrades (Priority 1)

**New Features**:
- Quick entry templates (pre-filled fields for common entries)
- Trend graphs for weight, sleep over 7/30/90 day periods
- Streak tracking (consecutive days logged)
- Export to CSV functionality
- Enhanced data visualization

**Technical Approach**:
- Use lightweight charting (chart.js or native SVG)
- Add date range selector
- Implement streak calculation utility

**Components**:
```
src/
├── views/
│   └── LogView/
│       ├── TrendChart.tsx
│       ├── StreakDisplay.tsx
│       ├── QuickEntryTemplates.tsx
│       └── ExportControls.tsx
├── utils/
│   ├── chartHelpers.ts
│   └── streakCalculator.ts
```

### 5. Micro-interactions & UX Polish (Priority 2)

**Enhancements**:
- Haptic feedback on task completion (Web Vibration API)
- Celebration animation on workout completion
- Swipe gestures for quick actions
- Keyboard shortcuts:
  - `Space` - Mark complete
  - `N` - Next task
  - `/` - Search
  - `Esc` - Close modals
- Inline tooltips for complex features
- Loading states with skeleton screens
- Error boundaries for graceful failure handling

**Implementation Files**:
```
src/
├── components/
│   └── ui/
│       ├── SkeletonLoader.tsx
│       ├── CelebrationAnimation.tsx
│       └── SwipeableCard.tsx
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useHapticFeedback.ts
│   └── useSwipeGestures.ts
├── utils/
│   └── animations.ts
```

### 6. State Management with Zustand (Priority 1)

**Purpose**: Replace prop drilling with centralized state management

**Implementation**:
```typescript
// stores/useAppStore.ts
interface AppState {
  // Schedule & Completion
  schedule: Array<ScheduleBlock>;
  completion: Record<string, Record<string, boolean>>;
  
  // Active Context
  activeTask: Task | null;
  setActiveTask: (task: Task | null) => void;
  
  // Workout State
  workoutSession: WorkoutSession | null;
  startWorkout: (exercises: Array<Exercise>) => void;
  updateWorkoutPhase: (phase: WorkoutPhase) => void;
  
  // Nutrition State
  mealTemplatesByDay: Record<string, Array<MealTemplate>>;
  mealLog: Record<string, Record<string, boolean>>;
  
  // Supplements
  supplementsList: Array<SupplementItem>;
  suppLog: Record<string, Record<string, boolean>>;
  
  // Log
  logEntries: Array<LogEntry>;
  addLogEntry: (entry: LogEntry) => void;
  
  // UI State
  toast: ToastState;
  showToast: (message: string, type: ToastType) => void;
}
```

**File Structure**:
```
src/
├── stores/
│   ├── useAppStore.ts
│   ├── slices/
│   │   ├── scheduleSlice.ts
│   │   ├── workoutSlice.ts
│   │   ├── nutritionSlice.ts
│   │   ├── supplementsSlice.ts
│   │   └── logSlice.ts
│   └── middleware/
│       └── localStoragePersist.ts
```

**Migration Strategy**:
1. Install Zustand: `npm install zustand`
2. Create store structure with slices
3. Add localStorage persistence middleware
4. Gradually migrate hooks to use Zustand
5. Remove prop drilling from components
6. Update App.tsx to be lightweight container

### 7. Settings View (Priority 2)

**Features**:
- User profile management (name, goals, preferences)
- Data management (clear all data, backup/restore)
- Notification preferences
- Export/Import UI (move from hidden feature)
- App information and version
- Keyboard shortcuts reference

**Components**:
```
src/
├── views/
│   └── SettingsView/
│       ├── index.tsx
│       ├── UserProfile.tsx
│       ├── DataManagement.tsx
│       ├── NotificationSettings.tsx
│       └── KeyboardShortcuts.tsx
├── hooks/
│   └── useSettings.ts
```

**Settings Data Schema**:
```typescript
interface UserSettings {
  profile: {
    name: string;
    weightGoal?: number;
    calorieTarget?: number;
  };
  notifications: {
    enabled: boolean;
    mealReminders: boolean;
    workoutReminders: boolean;
    supplementReminders: boolean;
  };
  preferences: {
    weekStartsOn: 'sunday' | 'monday';
    timeFormat: '12h' | '24h';
    weightUnit: 'kg' | 'lbs';
  };
}
```

---

## Updated Data Architecture

### Enhanced Local Storage Schema

```typescript
{
  // Existing
  completion: { [YYYY-MM-DD]: { [blockId]: boolean } },
  top3: { [YYYY-MM-DD]: string },
  mechanism: { [YYYY-MM-DD]: string },
  schedule: Array<ScheduleBlock>,
  supp: { [id]: boolean },
  suppLog: { [YYYY-MM-DD]: { [id]: boolean } },
  mealTemplatesByDay: { [dayName]: Array<MealTemplate> },
  mealLog: { [YYYY-MM-DD]: { [mealId]: boolean } },
  supplementsList: Array<SupplementItem>,
  log: Array<LogEntry>,
  
  // New additions
  workoutPrograms: {
    [dayName]: Array<Exercise>
  },
  workoutHistory: {
    [YYYY-MM-DD]: {
      exerciseId: string,
      sets: Array<{ reps: number, weight: number }>,
      completedAt: string
    }
  },
  settings: UserSettings,
  macroTargets: {
    calories: number,
    protein: number,
    carbs: number,
    fats: number
  },
  version: string // for future migrations
}
```

---

## Implementation Priority Order

### Sprint 1: Foundation (Week 1-2)
1. ✅ Install Zustand and create store structure
2. ✅ Implement unified workout timer logic
3. ✅ Add nutrition "Add Meal" button
4. ✅ Standardize button widths across app
5. ✅ Create keyboard shortcuts hook

### Sprint 2: Focus Mode (Week 3-4)
1. ✅ Build useActiveContext hook
2. ✅ Create FocusView container and routes
3. ✅ Implement GymFocus, MealFocus, SupplementFocus components
4. Not implemented: quick action shortcuts
5. ✅ Design adaptive UI with progress indicators

### Sprint 3: Enhanced Features (Week 5-6)
1. ✅ Implement macro calculator
2. ✅ Add trend charts to LogView
3. ✅ Create Settings view
4. ✅ Implement data export functionality
5. ✅ Add workout day selector with calendar

### Sprint 4: Polish (Week 7-8)
1. ✅ Add micro-interactions and haptic feedback
2. ✅ Implement celebration animations
3. ✅ Add swipe gestures
4. ✅ Create skeleton loaders
5. ✅ Add error boundaries

---

**Last Updated**: 2026-01-30
**Maintained by**: Development team
**Review cycle**: Update after major refactors or architectural decisions

### Nice to have Libraries and Tools for Later

1. React Hook Form + Zod
2. Tanstack Query
3. date-fns
4. Testing Suite: vitest + @testing-library/react + @testing-library/jest-dom + @testing-library/user-event
5. Vite PWA Plugin
6. React Hot Toast
7. localStorage Encryption (crypto-js)
8. Immer (for complex state updates)
9. i18next react-i18next i18next-browser-languagedetector
10. Sentry

### Immediate Dependencies to Add

1. **zustand** - State management
2. **chart.js** or **recharts** - Data visualization for trends
3. **react-swipeable** - Swipe gesture support (optional, can use native touch events)
