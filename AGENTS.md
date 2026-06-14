# AGENTS.md

## Project Overview

Onyx is a focused daily operating system for training, nutrition, and personal
execution. It is a **mobile app** (Expo / React Native) backed by a small
REST API (Express + Prisma + PostgreSQL) with JWT auth. The backend is the
source of truth; the app mirrors the user's day locally for fast, glanceable
access and syncs through the API.

> The original single-page web client (Vite / React Router, `src/`, localStorage
> persistence) was removed on 2026-06-14. The repo is now mobile-only: everything
> lives in `mobile/` and `backend/`.

## Core Technology Stack

### Mobile (`mobile/`)

- **Expo** SDK 54 / **React Native** 0.81 / **React** 19
- **Expo Router** 6 (file-based routing under `app/`)
- **TypeScript** 5.9 (strict)
- **react-native-reanimated** + **react-native-gesture-handler** for animation/gestures
- **react-native-svg** for charts/rings, **expo-linear-gradient** / **expo-blur** for surfaces
- **expo-secure-store** (auth tokens), **@react-native-async-storage/async-storage** (local cache)
- **expo-notifications** + **expo-haptics** for reminders and feedback
- Fonts via **@expo-google-fonts** (Archivo display + JetBrains Mono numerals)

### Backend (`backend/`)

- **Express** 4.21 with **helmet**, **cors**, **cookie-parser**, **express-rate-limit**
- **Prisma** 5.22 + **PostgreSQL**
- **JWT** auth (access + refresh tokens, `jsonwebtoken` + `bcryptjs`)
- **Zod** for request validation and env parsing
- **TypeScript** 5.6, ESM modules, run with **tsx** (`tsx` is a runtime **dependency**,
  not a devDependency — the production seed/dev scripts need it)
- Deployed on **Render** (`backend/render.yaml`); free Postgres instance

### Development Tools

- **ESLint** 9 (flat config) with TS support; mobile adds `eslint-plugin-react-hooks`
- **Prettier** 3 for code formatting
- Automated tests are not set up yet (no Vitest/Jest in either package)

## Project Structure

Two independent packages. Run tooling from inside each (the repo root has no
shared build tooling anymore).

```
daily/
├── mobile/                     # Expo / React Native app
│   ├── app/                    # Expo Router routes (file-based)
│   │   ├── (auth)/             # login, register
│   │   ├── (tabs)/             # focus, program, nutrition, schedule, settings
│   │   ├── exercise/[name].tsx # dynamic exercise detail
│   │   ├── _layout.tsx         # root Stack + providers + font loading
│   │   ├── index.tsx           # entry/redirect
│   │   ├── onboarding.tsx
│   │   ├── supplements.tsx · log.tsx · program-editor.tsx
│   │   ├── achievements.tsx · insights.tsx
│   │   └── +not-found.tsx
│   ├── api/                    # typed fetch wrappers, one per backend resource
│   │   └── client.ts           # apiClient + token refresh + api.get/post/put/...
│   ├── components/
│   │   ├── ui/                 # shared primitives (Card, Button, Input, Sheet, …)
│   │   ├── layout/             # Header, ScreenContainer
│   │   ├── focus/ nutrition/ schedule/ log/ shared/   # feature components
│   │   └── NotificationResponder.tsx
│   ├── contexts/               # Auth/Data/Program/Schedule/Meals/Supplements/Timeline/Toast
│   ├── hooks/                  # useWorkout, useProgram, useActiveContext, useMeals, …
│   ├── utils/                  # achievements, insights, trends, nutrition, notifications, …
│   ├── data/weekdayData.ts     # seed/default day structure
│   ├── types/                  # apiTypes.ts, appTypes.ts
│   ├── theme.ts                # design tokens (see Theming)
│   ├── theme/sharedStyles.ts
│   ├── constants.ts
│   ├── eslint.config.js · tsconfig.json · app.json · package.json
└── backend/                    # Express API
    ├── src/
    │   ├── app.ts              # express app: helmet/cors/json/cookies/rateLimit + /api
    │   ├── server.ts           # listen entrypoint
    │   ├── routes/             # one router per resource + index.ts aggregator
    │   ├── controllers/        # request handlers
    │   ├── services/           # business logic (throw AppError)
    │   ├── middleware/         # auth, validate (Zod), errorHandler, rateLimit
    │   ├── validators/         # Zod schemas per resource
    │   ├── utils/              # jwt, password, response, errors, env
    │   ├── config/             # database (Prisma client), env
    │   └── types/
    ├── prisma/
    │   ├── schema.prisma       # data model (see Data Architecture)
    │   ├── migrations/
    │   └── seed/               # exercises, foods, programs, supplements (tsx)
    ├── render.yaml · eslint.config.js · tsconfig.json · package.json
```

## Data Architecture

PostgreSQL (via Prisma) is the source of truth. The schema lives in
`backend/prisma/schema.prisma`.

### Prisma models (grouped)

- **Auth / user**: `User`, `UserPreferences`, `RefreshToken`
- **Schedule**: `ScheduleBlock`, `Completion` (per-day block completion)
- **Supplements**: `Supplement` (single `timeAt: "HH:MM"` field — exact time, no
  timing/window strings), `SupplementLog`, plus `SupplementDatabase` reference data
- **Meals / nutrition**: `MealTemplate` (+ `MealTemplateTag`), `MealLog`, `Food`
  (reference), `UserFood` (saved list)
- **Daily logs**: `DailyLog` (bodyweight, sleep, steps, top sets, notes)
- **Workouts**: `WorkoutSession`, `WorkoutSetLog`, `ExerciseLibrary` (reference)
- **Programs**: `GymProgram`, `ProgramDay`, `ProgramExercise` (system + user programs)
- **Score spine**: `DailyScore` — daily snapshot (`score`, tasks/supp/meals done,
  workout, protein, calories). Powers streaks, achievements, insights, and
  nutrition history on the client.

Dates are stored as `"YYYY-MM-DD"` strings; per-day records use
`@@unique([userId, …, date])`.

### Client-side state

The app keeps the current day's working set in React state (`AppState` in
`mobile/types/appTypes.ts`), normalized by `utils/normalize.ts` and cached in
**AsyncStorage** under key `andi_weekday_os_v1` (prefs under
`andi_weekday_os_prefs_v1`). Auth tokens live in **expo-secure-store**
(`onyx_access_token` / `onyx_refresh_token`). Import/export runs through the
`/api/sync` resource (`utils` + `useImportExport`).

## API Surface

All routes are mounted under `/api` (`backend/src/routes/index.ts`):

```
/api/auth          /api/schedule      /api/supplements   /api/meals
/api/logs          /api/foods         /api/programs      /api/supplement-db
/api/sync          /api/preferences   /api/user-foods    /api/workouts
/api/scores        /api/exercises     /api/health
```

Each resource follows the same path: `routes → controller → service`, with a Zod
schema in `validators/` applied by the `validate` middleware. Services throw
`AppError` (`utils/errors.ts`); `handleServiceError` maps Prisma errors (P2025 →
404, P2002 → 409, P2003 → 400) and the `errorHandler` middleware shapes the
response. Secrets are validated at boot in `config/env.ts` (`DATABASE_URL`,
`JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, …) — the process exits if any
are missing/invalid.

The mobile `api/client.ts` wraps `fetch`, attaches the bearer token, and
transparently refreshes on `401` (except `/auth/*`). Responses use the
`{ success, data?, error? }` envelope.

## Code Standards

### ESLint (flat config, ESLint 9)

- Mobile config: `mobile/eslint.config.js`. Backend config: `backend/eslint.config.js`.
- `no-undef` is **off** for TS files (TypeScript handles this better than ESLint).
- `@typescript-eslint/no-unused-vars` is an error, ignoring `^_` args and
  `^[A-Z_]` vars.
- **No spread / rest operators in `mobile/`** — enforced via `no-restricted-syntax`
  (`SpreadElement`, `RestElement`). Use `Object.assign()` instead. (See the
  `apiClient` header merge for the canonical pattern.)
- macOS resource-fork files pollute lint runs; both configs ignore `**/._*`
  (mobile also ignores `node_modules`/`.expo`, backend ignores `dist`).

### Prettier

```json
{
  "semi": true,
  "singleQuote": false,
  "printWidth": 90,
  "trailingComma": "es5"
}
```

### File Naming Conventions

- **Components**: PascalCase (`MealCard.tsx`, `StatBlock.tsx`)
- **Routes**: Expo Router lowercase / grouped (`(tabs)/nutrition.tsx`, `exercise/[name].tsx`)
- **Hooks / utils**: camelCase (`useWorkout.ts`, `notifications.ts`)

### Component Guidelines

- **Single Responsibility**: one primary concern per file; extract sub-components
  or hooks when a screen grows.
- **State sharing**: prefer the domain contexts over deep prop drilling.
- **Pure utilities**: side-effect-free helpers go in `mobile/utils/`.

### Import Order

1. React / React Native / external libraries
2. Contexts and hooks
3. Components
4. Utilities, data, types
5. Theme / styles

## State Management

The app uses a **context architecture**, composed in
`contexts/AppStateContext.tsx`:

- `AuthProvider` (token + session) wraps everything in `app/_layout.tsx`.
- `AppStateProvider` nests the domain providers: `Toast → Program → Data →
  Schedule → Meals → Supplements → Timeline`. `TimelineProvider` derives the
  unified day timeline from the other domains.
- Screens can pull domain-specific hooks (`useProgram`, `useSchedule`, …) or use
  the `useAppState()` shim, which merges all domain values for incremental
  migration.

React 19 / `react-hooks` notes that recur in this codebase:

- Capture `const data = result.data` after the `success` guard before passing it
  into `setState` closures (narrowing).
- Suppress `react-hooks/set-state-in-effect` with an inline comment for
  legitimate data-fetch / prop-sync effects.
- Don't return refs from hooks if they're read during render; keep the ref in the
  component and pass it in.
- `useCallback` only for handlers used as effect dependencies — don't wrap everything.

## Theming & Design

Design tokens live in `mobile/theme.ts`:

- **Dual palettes** (dark + light) resolved **once at module load** from the OS
  appearance (`Appearance.getColorScheme()`). Switching the phone's light/dark
  setting takes effect on next launch — there is no live runtime swap, because
  every `StyleSheet.create` snapshots `colors` at import time.
- Single jewel-blue **accent**, muted semantic colors (good/warning/danger/supplement),
  tonal surface steps, and soft `tints` for chips/fills.
- **Fonts**: Archivo (display/titles) + JetBrains Mono (all numerals), loaded via
  `expo-font` in the root layout.
- `spacing`, `radii`, `fontSizes`, and a `typeRamp` of preset size/weight combos —
  use these instead of hand-rolled values.
- Shared UI primitives in `components/ui/` (Card, Button, Input, Sheet, StatBlock,
  Ring, BarChart, Segmented, SettingsGroup, …) consume these tokens.

## Performance Considerations

- Use `FlatList`/`SectionList` for long histories rather than mapping arrays.
- `React.memo` for heavy list rows; debounce text inputs (`useDebouncedValue`).
- Keep animations on the UI thread via Reanimated worklets.

## Accessibility Standards

- Color contrast: 4.5:1 for text, 3:1 for large text (both palettes).
- `accessibilityLabel` / `accessibilityRole` on icon-only buttons.
- Respect the OS color scheme and adequate touch-target sizes.

## Commands

```bash
# Mobile (cd mobile)
npm install
npm start            # expo start (dev server / QR)
npm run android      # expo start --android
npm run ios          # expo start --ios
npm run lint         # eslint . --fix
npm run format       # prettier --write .
npm run typecheck    # tsc --noEmit

# Backend (cd backend)
npm install
npm run dev          # tsx watch src/server.ts
npm run build        # prisma generate && tsc
npm start            # node dist/server.js
npm run db:migrate   # prisma migrate dev
npm run db:push      # prisma db push
npm run db:seed      # tsx prisma/seed/index.ts
npm run db:studio    # prisma studio
npm run lint         # eslint src/
npm run format       # prettier src/ --check
```

> Run `tsc`/`eslint` from inside `mobile/` or `backend/` — the repo root has no
> shared tooling.

---

**Last Updated**: 2026-06-14
**Review cycle**: Update after major refactors or architectural decisions.
