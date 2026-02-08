# ONYX-PLAN.md

> **Living Document** | Last updated: 2026-02-08
> Primary reference for all AI coding agents working on the Onyx daily tracker.
> **Read this BEFORE starting any work.**

---

## Table of Contents

- [Project Overview](#project-overview)
- [Frontend Section](#-frontend-section)
  - [Technical Standards](#1-frontend-technical-standards)
  - [Technology Stack](#2-frontend-technology-stack)
  - [Architecture](#3-frontend-architecture)
  - [Features Breakdown](#4-frontend-features-breakdown)
- [Backend Section](#-backend-section)
  - [Technical Standards](#1-backend-technical-standards)
  - [Technology Stack](#2-backend-technology-stack)
  - [Architecture](#3-backend-architecture)
  - [Features & Endpoints](#4-backend-features--endpoints)
- [Shared Context](#-shared-context)
  - [Development Workflow](#1-development-workflow)
  - [Communication Protocol](#2-communication-protocol)
  - [Environment & Configuration](#3-environment--configuration)
- [Living Document Protocol](#-living-document-protocol)
- [Daily Plan Files](#-daily-plan-files)
- [Changelog](#changelog)

---

## Project Overview

**Onyx** is a full-stack health, fitness, and daily productivity tracker. It is designed as a personal operating system for structured daily execution.

### Core Features

1. **Habit & Daily Task Tracking** - Time-blocked schedule with completion tracking
2. **Personalized Gym Progression** - Program selection with double-progression tracking (Push/Pull/Legs + Shoulders split, Cardio + Abs)
3. **Supplement Intake Logging** - Tiered supplement stack with daily check-off and timing
4. **Food & Nutrition Tracking** - Day-of-week meal templates with macro tags, food database with per-100g nutritional values
5. **Daily Logging System** - Bodyweight, sleep, steps, top sets, notes
6. **Focus View** - Distilled "only what matters right now" view combining timeline, program, meals, and supplements

### Database Architecture

- **Foods database** - Complete nutritional values per 100g (calories, protein, carbs, fat, fiber, sugar, sodium)
- **Supplements database** - Reference data with category, typical dose, timing, benefits, precautions
- **Gym programs database** - Workout templates with days, exercises, sets/reps/RIR/rest, progression rules

---

## Frontend Section

### 1. Frontend Technical Standards

#### React Conventions

- **React 19** with `StrictMode` enabled
- **Functional components only** - no class components
- **Composition root pattern** - `App.tsx` (~460 lines) is the central orchestrator that wires hooks, state, and views together
- **Custom hooks** for all domain logic - hooks own API calls and state mutations
- **No prop drilling beyond one level** - hooks return everything views need

#### Component Composition

- Views are top-level feature containers (e.g., `TodayView`, `ProgramView`)
- Each view is wrapped in `<ErrorBoundary>` and `<ViewContainer>`
- Shared UI primitives live in `components/ui/` (Badge, Card, Pill, Toast, ConfirmModal, etc.)
- Shared interactive components in `components/shared/` (BlockItem, CompletionToggle, TimelineFilter)
- Layout components in `components/layout/` (Sidebar, Topbar, ViewContainer)

#### Styling Approach

- **Pure CSS** - no CSS-in-JS, no Tailwind, no component libraries
- Three CSS files: `app.css` (base/layout), `components.css` (component styles), `utilities.css` (utility classes)
- CSS custom properties (variables) for theming: `--bg`, `--text`, `--muted`, `--border`, `--accent`, `--good`, `--warning`, `--danger`, etc.
- Dark theme by default (`color-scheme: dark` in HTML meta)
- Font stack: Palatino/serif for branding (`--brand`), system sans-serif for UI (`--sans`), monospace for data (`--mono`)
- Radial gradient background on body for subtle visual depth
- Border-radius: `12px` for inputs/buttons, `22px` (`--radius2`) for cards
- Grid layout: `300px` sidebar + `1fr` main content, max-width `1200px`

#### TypeScript Usage

- **Strict mode** enabled (`"strict": true` in tsconfig)
- Target: `ES2022`, JSX: `react-jsx`
- Module: `ESNext` with `Bundler` resolution
- `type` keyword used for type-only imports (`import type { ... }`)
- Shared types in `src/types/appTypes.ts` - all domain types defined here
- No `any` usage - prefer `unknown` with type narrowing

#### Code Organization Rules

- **No spread/rest operators** - ESLint `no-restricted-syntax` enforced on both `SpreadElement` and `RestElement`. Use `Object.assign()` instead.
- `no-undef` disabled for TypeScript files (TypeScript handles this)
- Unused vars: `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^[A-Z_]"`
- React Hooks: `eslint-plugin-react-hooks` (flat config recommended)
- React Refresh: `eslint-plugin-react-refresh` (Vite mode)
- When suppressing ESLint rules, always add a comment explaining why (e.g., `// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on logout`)

#### Linting & Formatting

**ESLint** (v9, flat config via `eslint.config.js`):
- Separate config blocks for `.js/.jsx` and `.ts/.tsx` files
- `globalIgnores(['dist', '**/._*'])` - ignores build output and macOS resource fork files
- React Hooks and React Refresh plugins in both blocks
- Spread/rest operator ban in both blocks

**Prettier** (`.prettierrc`):
```json
{
  "semi": true,
  "singleQuote": false,
  "printWidth": 90,
  "trailingComma": "es5"
}
```

### 2. Frontend Technology Stack

#### Core Framework

| Technology | Version | Why |
|---|---|---|
| React | ^19.2.0 | Latest stable with concurrent features, used with StrictMode |
| React DOM | ^19.2.0 | DOM renderer for React 19 |
| Vite | ^7.2.4 | Fast HMR, ESM-native bundler, zero-config for React |
| TypeScript | ^5.6.3 | Type safety with strict mode, catches bugs at compile time |

#### Routing

| Technology | Version | Why |
|---|---|---|
| react-router-dom | ^7.2.0 | Client-side routing. Currently uses `BrowserRouter` with simple path-based routing (`/focus` vs `/`) |

**Routing structure:**
- `/focus` - Focus view (default redirect from `/`)
- `/` - Main app shell with tab-based view switching (Today, Program, Nutrition, Supplements, Log)
- View switching within `/` is state-based (`useState('today')`) not route-based

#### State Management

**No external state library** - state management is entirely React built-in:

- `useState` + `useEffect` at `App.tsx` level for global `AppState`
- `AppState` is a single object containing all domain data (schedule, supplements, meals, logs, completions)
- Custom hooks receive `appState` and `setAppState` to read/mutate state
- `useMemo` for derived computations (timeline blocks, visible blocks)
- `useRef` for non-reactive values (timers, input refs, init flags)
- `useCallback` only for handlers used as effect dependencies (e.g., `resetProgram`)
- `AuthContext` (React Context) for auth state only

**State flow:**
1. On auth, `exportUserData()` fetches full state from backend
2. `normalizeState()` ensures consistent shape
3. Hooks mutate state optimistically after successful API calls via `setAppState((prev) => ...)`
4. Local preferences (e.g., `showAllTimeline`) stored in `localStorage`

#### Data Fetching

**Native `fetch` API** - no Axios, no TanStack Query:

- Custom `apiClient` in `src/api/client.ts` wraps `fetch` with:
  - Automatic `Authorization: Bearer <token>` header injection
  - Automatic 401 retry with token refresh (single refresh deduplication)
  - `credentials: 'include'` for httpOnly cookie refresh tokens
  - Consistent `ApiResponse<T>` return type `{ success, data?, error?, message? }`
- Convenience methods: `api.get()`, `api.post()`, `api.put()`, `api.patch()`, `api.delete()`
- API base URL from `VITE_API_URL` env var, defaults to `http://localhost:3001/api`

#### Additional Frontend Libraries

None beyond core React + React Router. The frontend is intentionally dependency-light.

### 3. Frontend Architecture

#### Folder Structure

```
src/
  api/                    # API client modules (one per domain)
    auth.ts               # Login, register, logout, refresh, getMe
    client.ts             # Base apiClient with auth interceptor
    foods.ts              # Food search, get, create
    logs.ts               # Daily log CRUD + stats
    meals.ts              # Meal templates + meal logs
    preferences.ts        # User preferences get/update
    programs.ts           # Program list + detail
    schedule.ts           # Schedule blocks CRUD + completions
    supplementDb.ts       # Supplement database search
    supplements.ts        # User supplements CRUD + supplement logs
    sync.ts               # Full state import/export
    userFoods.ts          # User saved foods list
  assets/
    favicon.svg
    logo.svg
  components/
    ErrorBoundary.tsx     # Class component error boundary
    layout/
      Sidebar.tsx         # Navigation sidebar with progress, day label, meta
      Topbar.tsx          # View title + subtitle + action buttons
      ViewContainer.tsx   # Conditional render wrapper (display: none pattern)
    shared/
      BlockItem.tsx       # Timeline block item (editable)
      CompletionToggle.tsx # Checkbox toggle for completions
      TimelineFilter.tsx  # Timeline filter controls
    ui/
      Badge.tsx           # Status badge
      Card.tsx            # Card container
      ConfirmModal.tsx    # Confirmation dialog modal
      Pill.tsx            # Tag/pill component
      ProgramSetupModal.tsx # First-time program selection modal
      TimeSlotPicker.tsx  # Time range picker
      Toast.tsx           # Toast notification
  constants.ts            # App-wide constants (durations, intervals)
  contexts/
    AuthContext.tsx        # Authentication context provider + useAuth hook
  data/
    weekdayData.ts        # Default/fallback data (schedule, programs, meals, supplements, meta)
  hooks/
    useActiveContext.ts   # Active context detection
    useCompletion.ts      # Schedule block completion tracking
    useDebouncedValue.ts  # Debounced value hook
    useImportExport.ts    # JSON import/export with confirmation
    useLocalStorage.ts    # localStorage wrapper hook
    useLog.ts             # Daily log entries CRUD
    useMeals.ts           # Meal templates + meal logging
    useProgram.ts         # Program selection + detail loading
    useWorkout.ts         # Auto-advancing workout flow (timer, sets, rest, exercise progression)
    useSupplements.ts     # Supplement CRUD + logging
    useToast.ts           # Toast notification state
    useToday.ts           # Timeline visibility + next block calculation
  styles/
    app.css               # Base styles, CSS variables, layout
    components.css        # Component-specific styles
    utilities.css         # Utility classes
  types/
    appTypes.ts           # All domain types (AppState, ScheduleBlock, MealTemplate, etc.)
  utils/
    formatting.ts         # Number/time formatting helpers
    normalize.ts          # State normalization, meal template helpers, timeline block builders
    nutrition.ts          # buildNutritionTargets(), getGoalLabel() - dynamic targets from user weight + program goal
    storage.ts            # localStorage helpers, ensureState, todayKey
    time.ts               # Time math (toMinutes, getNowMinutes, getWeekdayName, getCurrentNextBlocks)
  views/
    AuthView/
      AuthView.tsx        # Login/register form
      index.ts            # Barrel export
    FocusView/
      GymFocus.tsx        # Gym program focus card
      MealFocus.tsx       # Meal tracking focus card
      NutritionFocusSection.tsx
      ProgramFocusSection.tsx
      SupplementFocus.tsx # Supplement tracking focus card
      TimelineFocusSection.tsx
      index.tsx           # FocusView composition
    LogView/
      index.tsx           # Log entry list + add form
    NutritionView/
      MacroBar.tsx        # Macro progress bar
      MealCard.tsx        # Meal template card
      index.tsx           # Nutrition view with day selector
    ProgramView/
      MovementList.tsx    # Exercise list display
      SessionCard.tsx     # Program session card
      index.tsx           # Program view with selector
    SupplementsView/
      SupplementCard.tsx  # Individual supplement card
      SupplementForm.tsx  # Add/edit supplement form
      TierSection.tsx     # Grouped supplements by tier
      index.tsx           # Supplements view
    TodayView/
      QuickActions.tsx    # Quick action buttons
      Timeline.tsx        # Timeline block list
      index.tsx           # Today view with timeline + progress
  App.tsx                 # Composition root (~460 lines)
  main.tsx                # Entry point (StrictMode + BrowserRouter + AuthProvider)
  vite-env.d.ts           # Vite type declarations
```

#### Component Hierarchy

```
<StrictMode>
  <BrowserRouter>
    <AuthProvider>
      <App>
        (if !authenticated) <AuthView />
        (if authenticated)
          <Sidebar />
          <main>
            <Topbar />
            <ViewContainer> <TodayView /> </ViewContainer>
            <ViewContainer> <ProgramView /> </ViewContainer>
            <ViewContainer> <NutritionView /> </ViewContainer>
            <ViewContainer> <SupplementsView /> </ViewContainer>
            <ViewContainer> <LogView /> </ViewContainer>
            <ViewContainer> <FocusView /> </ViewContainer>
          </main>
          <Toast />
          <ProgramSetupModal />
          <ConfirmModal />
        </App>
    </AuthProvider>
  </BrowserRouter>
</StrictMode>
```

#### Custom Hooks Pattern

All domain hooks follow the same pattern:
1. Receive `appState`, `setAppState`, `todayKeyValue`, `showToast` as params
2. Derive read-only values from `appState`
3. Expose async mutation functions that:
   - Call the API first
   - On success: update local state via `setAppState((prev) => ...)`
   - On failure: show toast error message
4. Use `Object.assign()` for all object copies (no spread)
5. Use `ensureState()` before mutating state to guarantee shape

### 4. Frontend Features Breakdown

#### Focus View (`/focus`)
- **Purpose:** Distilled view showing only what matters right now
- **Sub-components:** TimelineFocusSection, ProgramFocusSection, NutritionFocusSection, SupplementFocus, GymFocus, MealFocus
- **Data:** Receives timeline blocks, program rows, meal templates, supplement checks from App.tsx
- **Default landing page** (redirected from `/`)

#### Today View
- **Purpose:** Full daily timeline with block completion tracking
- **Sub-components:** Timeline, QuickActions
- **Features:** Block add/edit/delete, completion toggle, progress bar, next-block indicator
- **Timeline modes:** Show all blocks vs. current + next only (persisted preference)

#### Program View
- **Purpose:** Gym program selection and exercise display
- **Features:** Program selector dropdown, day selector, exercise table with sets/reps/RIR/rest/notes/progression, copy-to-clipboard
- **Sub-components:** SessionCard, MovementList

#### Nutrition View
- **Purpose:** Day-of-week meal template management and daily meal logging
- **Features:** Day selector (Mon-Sun), meal template CRUD, macro tag display, meal check-off
- **Sub-components:** MealCard, MacroBar

#### Supplements View
- **Purpose:** Supplement stack management and daily intake logging
- **Features:** Tiered display, supplement CRUD, daily check-off, clear all, supplement timing
- **Sub-components:** SupplementCard, SupplementForm, TierSection

#### Log View
- **Purpose:** Daily metrics tracking (bodyweight, sleep, steps, top sets, notes)
- **Features:** Add/edit entries, delete individual entries, clear all

#### Auth View
- **Purpose:** Login and registration
- **Features:** Email/password auth, profile fields (username, age, weight)

#### Keyboard Shortcuts
- Keys `1-5` switch between Today, Program, Nutrition, Supplements, Log views
- Disabled when in Focus view or when an input/textarea/select is focused

---

## Backend Section

### 1. Backend Technical Standards

#### API Design

- **RESTful API** with consistent resource-based routing
- All routes prefixed with `/api`
- Standard HTTP methods: GET (read), POST (create/action), PUT (full update), PATCH (partial update), DELETE
- Consistent response format: `{ success: boolean, data?: T, error?: string, message?: string }`

#### Error Handling

- **`AppError`** class extends `Error` with `statusCode` and optional `code`
- **`handleServiceError()`** converts Prisma errors to `AppError`:
  - `P2025` (not found) -> 404
  - `P2002` (unique constraint) -> 409
  - `P2003` (foreign key) -> 400
  - `PrismaClientValidationError` -> 400
  - Unknown -> 500
- **Global error handler middleware** catches all errors:
  - `AppError` -> structured response with status code
  - Development mode -> includes error stack trace
  - Production mode -> generic 500 response

#### Response Helpers

Standardized response functions in `utils/response.ts`:
- `sendSuccess(res, data, message?, status?)` - 200 by default
- `sendCreated(res, data, message?)` - 201
- `sendError(res, error, status?)` - 400 by default
- `sendUnauthorized(res, message?)` - 401
- `sendForbidden(res, message?)` - 403
- `sendNotFound(res, message?)` - 404
- `sendServerError(res, message?)` - 500

#### Validation

- **Zod** schemas for all request body validation
- `validate(schema)` middleware runs `schema.safeParse(req.body)` and returns first error message on failure
- Validated data replaces `req.body` with parsed output
- Validators organized in `validators/` directory by domain

#### Security

- **Helmet** for HTTP security headers
- **CORS** with explicit origin allowlist (comma-separated `CORS_ORIGIN` env var)
- **Rate limiting** via `express-rate-limit`:
  - General: 100 req/min
  - Auth endpoints: 5 req/min
- **bcryptjs** for password hashing
- JWT access tokens (15min) + httpOnly cookie refresh tokens (7 days)
- Environment validation via Zod schema on startup (crashes if invalid)

#### Code Organization Rules

- Controller -> Service -> Prisma pattern
- Controllers handle HTTP (req/res), services handle business logic
- Services throw `AppError` on failure, controllers catch and forward to error handler
- All route files apply `authMiddleware` at router level (except auth routes)

#### Linting & Formatting

**ESLint** (v9, flat config):
- `globalIgnores(['dist', '**/._*'])`
- TypeScript parser for all `.ts` files
- `no-undef: off` (TypeScript handles)
- `@typescript-eslint/no-unused-vars` with same pattern as frontend
- Node.js globals enabled

**Prettier** - identical config to frontend:
```json
{
  "semi": true,
  "singleQuote": false,
  "printWidth": 90,
  "trailingComma": "es5"
}
```

### 2. Backend Technology Stack

#### Framework

| Technology | Version | Why |
|---|---|---|
| Express | ^4.21.0 | Mature, minimal, large ecosystem. Simple middleware chain. |
| TypeScript | ^5.6.3 | Strict mode. Compiled to `dist/` via `tsc`. |
| tsx | ^4.19.2 | Dev server (`tsx watch`) + seed script runner. In **dependencies** (not devDeps) because Render needs it for `db:seed`. |

**TypeScript config:**
- Target: `ES2022`, Module: `NodeNext`, Resolution: `NodeNext`
- Output: `./dist`, Root: `./src`
- Strict mode, sourceMap, declaration + declarationMap enabled

#### Database & ORM

| Technology | Version | Why |
|---|---|---|
| PostgreSQL | - | Relational data with complex relationships. Hosted on Render (free tier). |
| Prisma | ^5.22.0 | Type-safe ORM with excellent migration tooling and schema-first design. |

**Migration strategy:**
- Development: `prisma migrate dev` for migration files
- Production: `prisma db push --skip-generate` in Render start command
- Schema changes require `prisma generate` to update client types

**Database connection:**
- Single `PrismaClient` instance in `config/database.ts`
- Development logging: `['query', 'error', 'warn']`
- Production logging: `['error']` only
- Graceful shutdown: `disconnectDatabase()` on SIGINT/SIGTERM

#### Authentication

| Technology | Version | Why |
|---|---|---|
| jsonwebtoken | ^9.0.2 | Industry standard JWT implementation |
| bcryptjs | ^2.4.3 | Password hashing (pure JS, no native deps) |

**Auth flow:**
1. Register/Login -> generates access token (15min, returned in response body) + refresh token (7 days, stored as httpOnly cookie + hashed in DB)
2. Access token sent as `Authorization: Bearer <token>` header
3. On 401 -> frontend calls `/auth/refresh` which uses httpOnly cookie
4. Refresh creates new access + refresh token pair, invalidates old refresh token
5. Logout deletes refresh tokens from DB and clears cookie

**Token storage:**
- Access token: in-memory variable on frontend (`client.ts`)
- Refresh token: httpOnly secure cookie + hash in `RefreshToken` table

#### Security Middleware

| Technology | Version | Why |
|---|---|---|
| helmet | ^8.0.0 | Sets security headers (CSP, X-Frame, etc.) |
| cors | ^2.8.5 | CORS with explicit origin allowlist |
| express-rate-limit | ^7.4.1 | Brute force protection |
| cookie-parser | ^1.4.6 | Parse httpOnly cookies for refresh tokens |

#### Validation

| Technology | Version | Why |
|---|---|---|
| zod | ^3.23.8 | Runtime schema validation with TypeScript inference |

#### Environment Configuration

| Technology | Version | Why |
|---|---|---|
| dotenv | ^16.4.5 | Load `.env` file in development |

Environment validated on startup via Zod schema in `config/env.ts`:
- `DATABASE_URL` - required, must be URL
- `JWT_SECRET` - required, min 32 chars
- `JWT_REFRESH_SECRET` - required, min 32 chars
- `PORT` - defaults to `3001`
- `NODE_ENV` - `development` | `production` | `test`, defaults to `development`
- `CORS_ORIGIN` - defaults to `http://localhost:5173`

### 3. Backend Architecture

#### Folder Structure

```
backend/
  prisma/
    schema.prisma          # Database schema (15 models)
    seed/
      index.ts             # Seed orchestrator
      foods.ts             # Food database seed data
      supplements.ts       # Supplement database seed data
      programs.ts          # Gym program seed data
  src/
    app.ts                 # Express app setup (middleware chain)
    server.ts              # Server entry point (listen + graceful shutdown)
    config/
      database.ts          # PrismaClient singleton + connect/disconnect
      env.ts               # Zod-validated environment variables
    controllers/
      auth.controller.ts
      foods.controller.ts
      logs.controller.ts
      meals.controller.ts
      preferences.controller.ts
      programs.controller.ts
      schedule.controller.ts
      supplementDb.controller.ts
      supplements.controller.ts
      sync.controller.ts
      userFoods.controller.ts
    middleware/
      auth.ts              # JWT Bearer token verification
      errorHandler.ts      # Global error handler
      rateLimit.ts         # Rate limiters (general + auth)
      validate.ts          # Zod validation middleware
    routes/
      index.ts             # Route aggregator
      auth.routes.ts
      foods.routes.ts
      logs.routes.ts
      meals.routes.ts
      preferences.routes.ts
      programs.routes.ts
      schedule.routes.ts
      supplementDb.routes.ts
      supplements.routes.ts
      sync.routes.ts
      userFoods.routes.ts
    services/
      auth.service.ts
      foods.service.ts
      logs.service.ts
      meals.service.ts
      preferences.service.ts
      programs.service.ts
      schedule.service.ts
      supplementDb.service.ts
      supplements.service.ts
      sync.service.ts
      userFoods.service.ts
    types/
      index.ts             # AuthenticatedRequest, JWTPayload, ApiResponse, shared types
    utils/
      env.ts               # (Duplicate? Check if used - main env is in config/)
      errors.ts            # AppError class + handleServiceError
      jwt.ts               # Token generation + verification
      password.ts          # bcrypt hash + compare
      response.ts          # Standardized response helpers
    validators/
      auth.schema.ts       # register, login, refresh schemas
      foods.schema.ts
      logs.schema.ts
      meals.schema.ts
      schedule.schema.ts
      supplements.schema.ts
      sync.schema.ts
```

#### Database Schema (15 Models)

**User & Auth:**
- `User` - id (UUID), email (unique), passwordHash, username?, age?, weight?
- `UserPreferences` - timezone, caffeineCutoff, sleepTarget, proteinTarget, hydrationTarget, selectedProgramId?, selectedProgramDayId?
- `RefreshToken` - tokenHash, expiresAt, indexed by userId and tokenHash

**Schedule & Completion:**
- `ScheduleBlock` - start/end (HH:MM strings), title, purpose?, good?, tag?, readonly, source (schedule|supplement|program|nutrition), sortOrder?
- `Completion` - blockId + date + isComplete, unique on (userId, blockId, date)

**Supplements:**
- `Supplement` - tier?, item, goal, dose, rule?, timeAt, sortOrder?
- `SupplementLog` - supplementId + date + isTaken, unique on (userId, supplementId, date)

**Meals & Nutrition:**
- `MealTemplate` - dayOfWeek, name, examples?, grams?, foodId?, sortOrder?
- `MealTemplateTag` - label + value (belongs to MealTemplate)
- `MealLog` - mealTemplateId + date + isEaten, unique on (userId, mealTemplateId, date)

**Daily Logs:**
- `DailyLog` - date, day?, bw?, sleep?, steps?, top?, notes?, unique on (userId, date)

**Reference Data:**
- `Food` - name, brand?, nutritional values per 100g (calories, protein, carbs, fat, fiber, sugar, sodium), isVerified
- `UserFood` - join table (userId + foodId), unique on (userId, foodId)
- `SupplementDatabase` - name, category?, typicalDose?, timingRecommendation?, benefits?, precautions?

**Gym Programs:**
- `GymProgram` - name, description?, goal (bulk/cut/strength/general/recomp), isSystem, userId?
- `ProgramDay` - name, dayOrder (belongs to GymProgram)
- `ProgramExercise` - exerciseName, sets, reps, rir?, restSeconds?, notes?, progression?, sortOrder

#### Middleware Chain (in order)

1. `helmet()` - security headers
2. `cors()` - origin allowlist
3. `express.json({ limit: '10mb' })` - JSON body parsing (large limit for import)
4. `express.urlencoded({ extended: true })` - URL-encoded parsing
5. `cookieParser()` - cookie parsing for refresh tokens
6. `generalRateLimiter` - 100 req/min global
7. `/api` routes (with per-route auth + validation middleware)
8. `errorHandler` - global error catch

### 4. Backend Features & Endpoints

#### Auth (`/api/auth`)
| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/register` | No | Auth (5/min) | Create account |
| POST | `/login` | No | Auth (5/min) | Login, returns access + refresh tokens |
| POST | `/refresh` | No | No | Refresh access token via httpOnly cookie |
| POST | `/logout` | Yes | No | Invalidate refresh tokens |
| GET | `/me` | Yes | No | Get current user + preferences |

#### Schedule (`/api/schedule`)
| Method | Path | Auth | Validation | Description |
|---|---|---|---|---|
| GET | `/` | Yes | - | List user's schedule blocks |
| POST | `/` | Yes | createBlockSchema | Create schedule block |
| PUT | `/:id` | Yes | updateBlockSchema | Update schedule block |
| DELETE | `/:id` | Yes | - | Delete schedule block |
| GET | `/completions` | Yes | - | Get completions (query: `date`) |
| POST | `/completions` | Yes | toggleCompletionSchema | Toggle block completion |

#### Supplements (`/api/supplements`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List user's supplements |
| POST | `/` | Yes | Create supplement |
| PUT | `/:id` | Yes | Update supplement |
| DELETE | `/:id` | Yes | Delete supplement |
| GET | `/logs` | Yes | Get supplement logs (query: `startDate`, `endDate`) |
| POST | `/:id/log` | Yes | Toggle supplement taken |

#### Meals (`/api/meals`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/templates` | Yes | List meal templates (query: `day`) |
| POST | `/templates` | Yes | Create meal template |
| PUT | `/templates/:id` | Yes | Update meal template |
| PATCH | `/templates/:id/grams` | Yes | Update meal grams |
| DELETE | `/templates/:id` | Yes | Delete meal template |
| GET | `/logs` | Yes | Get meal logs (query: `date`) |
| POST | `/:id/log` | Yes | Toggle meal eaten |

#### Logs (`/api/logs`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List daily logs (query: `startDate`, `endDate`) |
| GET | `/stats` | Yes | Get log statistics (query: `days`) |
| GET | `/:date` | Yes | Get single daily log |
| POST | `/` | Yes | Create or update daily log (upsert by date) |
| DELETE | `/:id` | Yes | Delete daily log |

#### Programs (`/api/programs`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List all programs (system + user) |
| GET | `/:id` | Yes | Get program detail with days + exercises |

#### Foods (`/api/foods`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | Search foods (query: `search`, `limit`) |
| GET | `/:id` | Yes | Get single food |
| POST | `/` | Yes | Create food |

#### Supplement Database (`/api/supplement-db`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | Search supplement database (query: `search`, `limit`) |

#### User Foods (`/api/user-foods`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List user's saved foods |
| POST | `/` | Yes | Save food to user's list |
| DELETE | `/:id` | Yes | Remove food from user's list |

#### Preferences (`/api/preferences`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | Get user preferences |
| PUT | `/` | Yes | Update user preferences |

#### Sync (`/api/sync`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/export` | Yes | Export full user state as AppState |
| POST | `/import` | Yes | Import AppState (replaces existing data) |
| GET | `/state` | Yes | Get full structured state |

#### Health (`/api/health`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Health check, returns `{ status: 'ok', timestamp }` |

---

## Shared Context

### 1. Development Workflow

#### Local Development Setup

**Frontend:**
```bash
npm install
npm run dev          # Vite dev server on :5173
```

**Backend:**
```bash
cd backend
npm install
cp .env.example .env # Edit with your DB credentials
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema to database
npm run db:seed      # Seed reference data
npm run dev          # tsx watch on :3001
```

#### Available Scripts

**Frontend:**
- `npm run dev` - Vite dev server
- `npm run build` - Production build
- `npm run lint` - ESLint check
- `npm run format` - Prettier check
- `npm run format:write` - Prettier auto-fix
- `npm run typecheck` - TypeScript type checking
- `npm run preview` - Preview production build

**Backend:**
- `npm run dev` - tsx watch dev server
- `npm run build` - `prisma generate && tsc`
- `npm start` - Run compiled `dist/server.js`
- `npm run db:generate` - Regenerate Prisma client
- `npm run db:push` - Push schema changes
- `npm run db:migrate` - Create migration
- `npm run db:seed` - Seed reference data
- `npm run db:studio` - Open Prisma Studio
- `npm run lint` / `npm run lint:fix` - ESLint
- `npm run format` / `npm run format:write` - Prettier

#### How to Approach New Features

1. **Read this plan** before starting
2. Check if existing patterns cover the feature
3. For new domains: create API module, hook, view, backend route/controller/service/validator
4. Follow the existing patterns exactly (Object.assign, ensureState, etc.)
5. Run `npm run lint` and `npm run typecheck` before considering done
6. Update this plan if new patterns are established

#### Git Workflow

- Main branch: `main`
- Commit messages: concise, descriptive, prefixed by type when obvious
- No CI/CD pipeline currently configured
- Manual deploy to Vercel (frontend) and Render (backend)

### 2. Communication Protocol

#### API Contract

- All API responses follow `{ success: boolean, data?: T, error?: string, message?: string }`
- Frontend `ApiResponse<T>` matches backend `ApiResponse<T>` (defined in both `src/api/client.ts` and `backend/src/types/index.ts`)
- Date strings: `"YYYY-MM-DD"` format
- Time strings: `"HH:MM"` format (24h)
- IDs: UUID v4 strings

#### Shared Types

Types are defined in parallel in both codebases:
- **Frontend:** `src/types/appTypes.ts` - `AppState`, `ScheduleBlock`, `MealTemplate`, `SupplementItem`, `LogEntry`, `MetaData`
- **Backend:** `backend/src/types/index.ts` - mirrors frontend types for sync compatibility

These must be kept in sync manually when types change.

#### Error Response Format

```typescript
// Success
{ success: true, data: { ... }, message?: "Optional message" }

// Error
{ success: false, error: "Human-readable error message" }
```

### 3. Environment & Configuration

#### Frontend Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001/api` | Backend API base URL |

#### Backend Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET` | Yes | - | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | - | Refresh token signing secret (min 32 chars) |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed origins (comma-separated) |

#### Deployment

| Platform | Service | Config File |
|---|---|---|
| **Vercel** | Frontend (SPA) | `vercel.json` - SPA rewrite rule |
| **Render** | Backend + PostgreSQL | `backend/render.yaml` - web service + database |

**Render build:** `npm install && npm run build`
**Render start:** `npx prisma db push --skip-generate && npm start`

---

## Living Document Protocol

### Update Rules

1. **Before making stack changes:** The agent MUST ask for permission first
   - Explain the proposed change
   - Provide rationale for why it's better
   - Outline migration impact

2. **After approved changes:** The agent MUST update this plan to reflect:
   - New technology added (with rationale)
   - Removed technology (with reason)
   - Changed patterns or conventions
   - Updated folder structures
   - New best practices established

3. **Critical rules that must NEVER be violated without explicit permission:**
   - No spread/rest operators on frontend
   - Object.assign() for all object copies
   - ensureState() before state mutations
   - API-first then local state update pattern
   - Consistent response format
   - Zod validation for all request bodies

### Agent Responsibilities

- Read this plan BEFORE starting any work
- Propose improvements when you identify better approaches
- Update this plan after approved changes
- Maintain consistency with established patterns
- Flag inconsistencies or outdated information
- Never introduce new dependencies without permission

---

## Daily Plan Files

### Format

```
plans/
  DDMMYY-frontend-plan.md
  DDMMYY-backend-plan.md
```

### Template

```markdown
# [Frontend/Backend] Plan - DD/MM/YY

## Features Developed
- [ ] Feature description

## Components/Endpoints Created
- `path/to/file.ts` - Description

## Issues Encountered & Resolved
- **Issue:** Description
  **Resolution:** How it was fixed

## Pending Tasks
- [ ] Task description

## Session Context
- Notes about decisions made, trade-offs considered

## ONYX-PLAN.md Updates
- [ ] Any updates made to the main plan
```

---

## CHANGELOG

### [2026-02-08] - Initial Plan Creation
- **Created:** Complete ONYX-PLAN.md from codebase analysis
- **Documented:** Full frontend architecture (React 19 + Vite 7 + TypeScript strict)
- **Documented:** Full backend architecture (Express + Prisma + PostgreSQL)
- **Documented:** All 11 API route groups with endpoints
- **Documented:** 15 Prisma models with relationships
- **Documented:** Auth flow (JWT access + httpOnly refresh tokens)
- **Documented:** Code conventions (no spread, Object.assign, ensureState pattern)
- **Documented:** Deployment config (Vercel + Render)

### [2026-02-08] - Workout Flow + Focus Timer + Sidebar Fixes
- **Added:** `src/hooks/useWorkout.ts` - auto-advancing workout hook: 60s per set, 30s rest between sets, pause/skip/stop, exercise completion tracking
- **Changed:** `src/components/layout/Sidebar.tsx` - nutrition nav item shows dynamic goal label + user weight instead of hardcoded "Lean bulk" / "72-75"; accepts `programGoal` and `userWeight` props
- **Changed:** `src/views/FocusView/ProgramFocusSection.tsx` - complete rewrite: single exercise card with workout timer, progress bar, Start/Pause/Skip/Stop controls, exercise list with done/current state
- **Changed:** `src/views/FocusView/index.tsx` - accepts and passes through workout state + callbacks to ProgramFocusSection
- **Changed:** `src/views/ProgramView/index.tsx` - removed all timer state and SessionCard; added `completedExercises` prop to show green completed rows
- **Changed:** `src/views/ProgramView/MovementList.tsx` - removed Rest button; accepts `completedExercises` prop, renders green rows for completed exercises
- **Changed:** `src/App.tsx` - integrates `useWorkout` hook, passes workout state to FocusView and `completedExercises` to ProgramView; passes `programGoal`/`userWeight` to Sidebar
- **Changed:** `src/styles/components.css` - added workout flow CSS (workoutTimerWrap, workoutExerciseCard, focusCompactItemDone/Current, exerciseRowDone)
- **Deprecated:** `src/views/ProgramView/SessionCard.tsx` - no longer imported (timer moved to Focus view)
- **Reason:** Timer belonged in Focus (active workout context), not in Program (reference view). Sidebar had hardcoded values.
- **Impact:** Workout flow is now: Focus → Start → auto-advances 60s work / 30s rest per set → marks exercises done → "Workout complete!". Program view shows green completed rows in real-time.

### [2026-02-08] - Dynamic Nutrition Targets
- **Added:** `src/utils/nutrition.ts` - `buildNutritionTargets()` and `getGoalLabel()` utilities
- **Changed:** `src/App.tsx` - nutrition targets now computed from user weight + program goal instead of hardcoded `DATA.nutritionTargets`
- **Changed:** `src/views/NutritionView/index.tsx` - accepts `programGoal` prop, card heading is dynamic ("Targets (lean bulk)", "Targets (cut)", etc.)
- **Reason:** Nutrition targets were hardcoded and did not reflect user data or selected gym program
- **Impact:** Targets card now adapts to: user weight (protein/fat/carb gram ranges), program goal (bulk/cut/recomp/strength/general), user preferences (hydration). Falls back gracefully when weight is not set.
