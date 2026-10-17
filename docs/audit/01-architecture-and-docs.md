# Audit 01 — Architecture, Docs Drift, History, Lint Rule, Prisma

Audited at HEAD `47df93e` (2026-07-04) on 2026-10-17. Working tree had uncommitted
changes from other work in progress (`mobile/api/client.ts` adds `EXPO_PUBLIC_API_URL`,
`backend/package.json` adds `embedded-postgres`, untracked `e2e/`,
`mobile/api/tokenStore*.ts`); findings below are about committed code unless marked.

Verification commands run (read-only, nothing written except this file):

| Command | Result |
|---|---|
| `cd mobile && npx eslint .` (no `--fix`) | clean, 0 problems |
| `cd mobile && npx tsc --noEmit` | exit 0 |
| `cd mobile && npx vitest run` | 7 files, 48 tests pass |
| `cd backend && npx eslint src/` | clean |
| `cd backend && npx tsc --noEmit` | clean |
| `cd backend && npx vitest run` | 3 files, 15 tests pass |
| `cd backend && npx prettier src/ --check` | **69 files fail** |
| `cd mobile && npx prettier --check .` | **57 files fail** |

---

## 1. Real architecture map

### Mobile (`mobile/`)

**Root tree** (`app/_layout.tsx:87-101`):
`GestureHandlerRootView → SafeAreaProvider → QueryClientProvider → ThemeProvider → AuthProvider → AppStateProvider → ErrorBoundary → Stack`.
- QueryClient: `retry: 1, staleTime: 30_000`, **no persistence** (`_layout.tsx:61-68`; grep for `persist` finds no query persister).
- ErrorBoundary sits *inside* AppStateProvider (`_layout.tsx:92-93`), so a throw in any domain provider is not caught.

**AppStateProvider** (`contexts/AppStateContext.tsx:94-105`):
`ToastProvider → ProgramProvider → DataProviderBridge(DataProvider) → ScheduleProvider → MealsProvider → SupplementsProvider → InnerProviders(TimelineProvider)`.
`InnerProviders` also re-syncs supplement reminders whenever `supplementsList` changes (`:23-29`).
`useAppState()` shim is still used by 2 screens: `app/log.tsx`, `app/supplements.tsx`.

**Server state** (`contexts/DataContext.tsx`):
- `useQuery(["appState"])` → `GET /api/sync/export` → `normalizeState` (`:105-115`).
- `useQuery(["scores"])` → `GET /api/scores?days=30` (`:117-127`).
- `setAppState` writes straight into the query cache via `setQueryData` (`:141-149`). Domain hooks (`useCompletion`, `useMeals`, `useSupplements`, `useLog`) call the API and then patch the cache.
- Date rollover: polls `todayKey()` every 60 s and on foreground (`:70-85`).
- Offline queue flush: on auth, every 60 s, and on foreground (`:89-101`).

**Offline queue** (`utils/mutationQueue.ts`):
- AsyncStorage key `onyx_mutation_queue_v1`.
- Covers only 3 toggle types: `completion | meal | supplement` (`:15`). Callers: `hooks/useCompletion.ts:40`, `hooks/useMeals.ts:41`, `hooks/useSupplements.ts:44`.
- Last write wins per (type, id, date) (`:81-84`). Entries expire after 7 days (`:12,105`).
- Server rejections are dropped (`:109-111`).
- Not queued: workout sessions and sets, score snapshots, meal and food adds, daily logs or check-ins, and all CRUD.

**API client** (`api/client.ts`):
- Bearer token, single-flight refresh on 401 except `/auth/*` (`:63-104,132-143`).
- `networkError: true` on any thrown fetch or JSON parse failure (`:147-153`).
- No request timeout (no `AbortController` anywhere in `api/`).
- Tokens are stored in SecureStore as `onyx_access_token` / `onyx_refresh_token` (`:10-11`).
- 14 resource wrappers: auth, exercises, foods, logs, meals, preferences, programs, schedule, scores, supplementDb, supplements, sync, userFoods, workouts.

**AsyncStorage keys actually written**:

| Key | Used for |
|---|---|
| `onyx_mutation_queue_v1` | offline toggle queue |
| `onyx_theme_mode` (`ThemeContext.tsx:22`) | theme choice |
| `onyx_water_<date>` (`useWater.ts:11`) | water count (local only, never synced) |
| `onyx_workout_done` (`useWorkout.ts:49`) | workout-done flag |
| `onyx_achievements_seen` (`achievements.ts:103`) | seen achievements |
| `onyx_notification_prefs` (`notifications.ts:11`) | notification settings |
| `onyx_recent_foods_v1` (`recentFoods.ts:8`) | recent foods |
| `onyx_checkin_dismissed`, `onyx_getting_started_dismissed`, `onyx_weekly_recap_dismissed` | card dismissals |

`andi_weekday_os_v1` / `andi_weekday_os_prefs_v1` appear only in `clearStorage()` (`utils/storage.ts:4-5,31`). Nothing ever writes them.

**Barcode** (`components/nutrition/BarcodeScannerSheet.tsx:3,52`):
- Uses `CameraView` and `useCameraPermissions` from expo-camera. The plugin and permission string are in `app.json` plugins.
- Lookup goes through `utils/openFoodFacts.ts` (commit `47df93e`).

**Routes**:
- `(auth)/{_layout,login,register}`
- `(tabs)/{_layout,focus,nutrition,program,schedule,settings}`. Tab order: focus, nutrition, program, … (`(tabs)/_layout.tsx:48-89`).
- `exercise/[name]`, `index`, `onboarding`, `supplements`, `log`, `program-editor`, `achievements`, `insights`, `+not-found`.

**Contexts (10)**: AppState, Auth, Data, Meals, Program, Schedule, Supplements, Theme, Timeline, Toast.

**Hooks (13)**: useActiveContext, useCompletion, useDebouncedValue, useImportExport, useLog, useMeals, useNow, useProgram, useSupplements, useToast, useToday, useWater, useWorkout.

**Utils (17, + `__tests__/`)**: achievements, adaptiveTargets, formatting, haptics, insights, mutationQueue, normalize, notifications, nutrition, openFoodFacts, plates, progression, quickParse, recentFoods, storage, time, trends.

**Theme**:
- `theme.ts` resolves a static `colors` at load (`theme.ts:64-67`).
- `ThemeContext` provides live `system|light|dark` switching, saved under `onyx_theme_mode` (`ThemeContext.tsx:35-80`).
- About 80 call sites use `useTheme()`. Only 5 files still import static `colors`: `_layout.tsx`, `greeting.ts`, `ErrorBoundary.tsx`, `Burst.tsx`, `sharedStyles.ts`.
- `app.json` sets `"userInterfaceStyle": "dark"`. On iOS that normally pins the OS-reported scheme to dark, so "System" mode may never follow a light OS setting. This is inference from Expo behaviour and needs checking on a device.

### Backend (`backend/`)

**Middleware** (`src/app.ts:13-48`), in order:
1. `trust proxy`
2. helmet
3. cors (allow-list from `CORS_ORIGIN`; no-Origin requests pass)
4. json (10 MB limit) and urlencoded
5. cookieParser
6. `generalRateLimiter` (100/min)
7. `/api` routes
8. `errorHandler`

`authRateLimiter` (5/min) is applied only in `auth.routes.ts`.

**Routes** (`src/routes/index.ts:19-37`): 14 resource routers plus `/health`. Each has a controller and a service. Zod validators exist for 9 resources: auth, foods, logs, meals, programs, schedule, supplements, sync, workouts.

**Sync** (`sync.routes.ts:16-19`):
- Endpoints: `POST /import`, `GET /export`, `GET /state`, `POST /seed-starter`.
- `importState` deletes and recreates 8 tables in one transaction (`sync.service.ts:94-104`).
- `exportState` reads 7 tables with **no date bound** (`sync.service.ts:275-289`). This is also the app's boot load.

**Env**: two env modules exist.
- `src/utils/env.ts`: lazy getters that throw on first access. Used only by `utils/jwt.ts:3`.
- `src/config/env.ts`: the Zod schema that calls `process.exit(1)` on bad env. **It is never imported** (`grep -rn "config/env" src` returns nothing).

**Prisma**: 21 models (`schema.prisma:14-356`); the per-model detail is in §6. Render runs `npx prisma db push --skip-generate && npm start` (`render.yaml:16`) on a free plan for both the web service and the database (`render.yaml:3,12`).

---

## 2. AGENTS.md vs reality

AGENTS.md was last touched in `aa218ff` (2026-06-14). The 20 commits since (`18f271f`…`47df93e`, all 2026-07-04) added tests, TanStack Query, the offline queue, expo-camera and more, without updating the doc.

| # | AGENTS.md claim | Reality | Evidence |
|---|---|---|---|
| 1 | "Automated tests are not set up yet (no Vitest/Jest in either package)" | Vitest in both packages. 7 mobile and 3 backend test files; 48 + 15 tests pass. `npm test` script in both. | `mobile/package.json` (`"test": "vitest run"`, devDep `vitest ^4.1.9`); `backend/vitest.config.ts`; commit `73c5ad9` |
| 2 | Client state "cached in AsyncStorage under key `andi_weekday_os_v1`" | AppState lives in the in-memory TanStack Query cache. That key is only ever *removed*, never written, so there is no offline cache of the day. | `DataContext.tsx:105-149`; `utils/storage.ts:4-5,31`; commit `f2928c7` |
| 3 | Stack list omits server-state library | `@tanstack/react-query ^5.101.2` holds all server state | `mobile/package.json`; `_layout.tsx:16,61-68,89` |
| 4 | No mention of offline queue | Persisted toggle queue `onyx_mutation_queue_v1` plus `SyncStatusPill` | `utils/mutationQueue.ts`; `components/shared/SyncStatusPill.tsx`; commits `8d4674c`, `9b8f8d8` |
| 5 | No mention of camera / barcode | `expo-camera ~17.0.10` with a config plugin; BarcodeScannerSheet; Open Food Facts | `app.json` plugins; `BarcodeScannerSheet.tsx:3`; `utils/openFoodFacts.ts` |
| 6 | Dependency list | Also unlisted: expo-clipboard, expo-document-picker, expo-file-system, expo-sharing, expo-keep-awake, `@react-native-community/datetimepicker`, `@react-native-community/slider`, react-native-worklets | `mobile/package.json` |
| 7 | "AuthProvider (token + session) wraps everything in `app/_layout.tsx`" | QueryClientProvider and ThemeProvider sit outside AuthProvider; ErrorBoundary sits inside AppStateProvider | `_layout.tsx:89-96` |
| 8 | Provider nesting `Toast → Program → Data → Schedule → Meals → Supplements → Timeline` | Correct, but Data goes through a `DataProviderBridge`, and Timeline is fed by an `InnerProviders` component that also syncs notification reminders. ThemeContext is not listed. | `AppStateContext.tsx:18-48,80-105` |
| 9 | Contexts "Auth/Data/Program/Schedule/Meals/Supplements/Timeline/Toast" | Plus `ThemeContext` and `AppStateContext` | `ls mobile/contexts` |
| 10 | "Dual palettes resolved once at module load … no live runtime swap" | Live System/Light/Dark toggle with saved choice, used in about 80 call sites | `ThemeContext.tsx:35-80`; `settings.tsx:38`; commits `3a73a82`, `9024127` |
| 11 | Components tree "focus/ nutrition/ schedule/ log/ shared/" | Also `supplements/` (SupplementCard, SupplementForm) and `focus/workout/` (FinishedView, IdleView, RestView, SetPills…) | `ls mobile/components`; commits `bc40d2f`, `75138c3` |
| 12 | Routes list | Omits `(auth)/_layout.tsx` and `(tabs)/_layout.tsx` (minor) | `ls mobile/app/*` |
| 13 | utils list "achievements, insights, trends, nutrition, notifications, …" | 17 files. Unlisted ones that matter: mutationQueue, openFoodFacts, plates, progression, quickParse, recentFoods, adaptiveTargets, haptics | `ls mobile/utils` |
| 14 | "Secrets are validated at boot in `config/env.ts` … process exits if any are missing" | `config/env.ts` is dead code. A missing `JWT_SECRET` surfaces only on the first sign or verify, through `utils/env.ts`. `CORS_ORIGIN` is read raw from `process.env`. | `grep "config/env" backend/src` returns nothing; `utils/jwt.ts:3`; `app.ts:20` |
| 15 | Mobile commands list | Also `web` and `test` | `mobile/package.json` scripts |
| 16 | Backend commands list | Also `db:generate`, `lint:fix`, `format:write`, `test` | `backend/package.json` scripts |
| 17 | `npm run format # prettier src/ --check` implies the code is formatted | Fails on 69 backend files. Backend source uses single quotes against `singleQuote:false`. Mobile fails on 57 files. | prettier commands in the table above; `app.ts:1` |
| 18 | "Use `FlatList`/`SectionList` for long histories" | 0 usages in `app/` or `components/` | `grep -rl "FlatList\|SectionList\|FlashList"` returns nothing |
| 19 | Deploy on Render, free Postgres | True, but the doc omits that start runs `prisma db push` (not `migrate deploy`) and that the free DB expires (flagged in `PRODUCT_STRATEGY_ANALYSIS.md:216`) | `render.yaml:3,16` |
| 20 | API envelope `{success,data?,error?}` | Client adds `message?` and `networkError?` | `client.ts:106-113` |
| 21 | Project structure | Omits `docs/` (8 plans), `future.ignore.md`, `.agents/` (tracked plans), `e2e/` (untracked), and the tracked `.claude/settings.local.json` (changed in 6 commits) | `git ls-files`; churn list in §4 |
| 22 | Prisma model list (21 models) | Matches `schema.prisma` (21 `model` blocks) | `grep ^model schema.prisma` |
| 23 | P2025→404, P2002→409, P2003→400 | Matches | `backend/src/utils/errors.ts:18-24` |
| 24 | Supplement single `timeAt "HH:MM"` | Matches (`@default("08:00")`) | `schema.prisma:114` |
| 25 | `apiClient` header merge is the canonical `Object.assign` pattern | Matches | `client.ts:119-123` |

---

## 3. Planning docs: verdict per item

Legend: **DONE**, **PARTIAL**, **STILL WORTH DOING** (SWD), **ABANDONED**, **OBSOLETE**.

### PRODUCT_STRATEGY_ANALYSIS.md (`566142d`), roadmap §10

| Item | Verdict | Evidence |
|---|---|---|
| 1 Seed starter day | DONE | `9d65952`; `sync.routes.ts:19` (`/seed-starter`) |
| 2 Day-close snapshot | PARTIAL | `9a2801b` (DailyScore). The snapshot is posted only from an effect in the Focus screen, and failures are swallowed with no queue (`focus.tsx:265-283`). A day where Focus is not opened after the last check never gets a final score. |
| 3 Achievements + visible reward | DONE | `e1ab317`, `aa218ff`; `utils/achievements.ts` |
| 4 Notification actions | PARTIAL | `205a309`. Categories: supplement "Mark taken" and check-in "Log now" (`notifications.ts:49-53`). Meal actions ("Mark eaten" in the UX blueprint) do not exist. A listener only (`NotificationResponder.tsx:20`) with no `getLastNotificationResponseAsync`, so an action tapped while the app is killed may be lost. |
| 5 Progression engine | DONE (core) | `55c256d`; `utils/progression.ts`. The plateau flag is missing: no `plateau` or `stall` match anywhere. |
| 6 HealthKit / Health Connect | SWD | No match for `healthkit` or `health-connect` |
| 7 Offline-first cache + queue | PARTIAL | The queue exists for 3 toggle types only. There is no persisted cache (§1), so an offline cold start shows an empty day. |
| 8 Nutrition history | DONE | `9dc60df` |
| 9 Exercise library + autocomplete | PARTIAL | `2496e0e` (autocomplete in the editor). The plan's "normalise on write" was not built: `workouts.service.ts:27` stores `exerciseName` raw, and the validator is only `min(1).max(200)` (`workouts.schema.ts:11`). |
| 10 Insights v1 | DONE (correlations); weekly narrative not built | `baa0577`; `utils/insights.ts` |
| 11 AI weekly coach | SWD (low priority) | No match for anthropic, claude or llm |
| 12 Light mode / theming | DONE | `24e7c66`, `9024127` |
| 12 Tablet layout | SWD (low) | `supportsTablet: true` in `app.json`; no `useWindowDimensions` responsive code |
| 13 Adaptive targets | DONE (protein) | `f559b62`, `a15527a`. Learned reminder times not built. |
| 14 Selective social / benchmarks | OBSOLETE | Single-user app per brief; no code |
| 15 Brand pass | ABANDONED | `assets/` has only stock icon/splash PNGs; no illustration set |
| §6 Commitment / weekly intention, levels / tiers | SWD (intention ties to the consistency goal); levels ABANDONED | No match for intention or level-up code |
| Housekeeping: web `src/` delete, Vercel teardown | DONE | `5130b09` deleted `vercel.json` and `vite.config.js` (86 files, −14,716 lines) |
| Housekeeping: Render DB expiry | **SWD, high priority** | Still `plan: free` (`render.yaml:3`) |
| Housekeeping: a11y audit | PARTIAL | See the UI_OVERHAUL_TODO section below |
| §11 Instrumentation | SWD (personal metrics only) | No analytics code. DailyScore is the only longitudinal metric. |

### PROGRAM_EXERCISES_PLAN.md

| Item | Verdict | Evidence |
|---|---|---|
| Phase 1: exercise detail + history charts | DONE | `ccc0ae4`; `app/exercise/[name].tsx`; `/workouts/exercise-sessions` route (`workouts.routes.ts:25`) |
| Phase 2: progression chips | DONE | `55c256d` |
| Phase 3: interactive session card | DONE | `c4434f1` |
| Phase 3: week strip with done-dots | SWD | No match for a strip or done-dot component |
| Phase 4: library | DONE | `2496e0e` |
| Phase 4: name normalisation | SWD (data-integrity bug remains) | See roadmap item 9 above |
| Phase 5: volume per muscle | SWD | `primaryMuscle` appears only in the editor suggestion label (`program-editor.tsx:295`) |
| Phase 6: duplicate | DONE (duplicate program) | `program.tsx:237` sets `duplicate: "1"` |
| Phase 6: reorder, rest stepper | SWD (low) | No reorder found in `program-editor.tsx` |
| Plateau flag | SWD | See roadmap item 5 above |

### SCREENS_OVERHAUL_PLAN.md

DONE. `5ba5f88` built SettingsGroup/Row, Segmented and BarChart, the Settings groups, the nutrition dedupe and the program Segmented control; all exist in `components/ui/`. Nothing left.

### UI_EXCELLENCE_PLAN.md (P1–P5)

DONE in bulk: `b727615` (30 files) and `72cf3a4` built Glow, Burst, AnimatedNumber, Ring gradient, blur tab bar, skeleton LoadingScreen, and haptics.

Remaining:
- AnimatedNumber is used only in `MacroDashboard.tsx`; Day Score and streak are not wired.
- `haptics.warn` is defined but never used (§4).

Verdict: DONE / OBSOLETE (superseded by DESIGN_SYSTEM.md).

### DESIGN_LANGUAGE_REDESIGN.md

- DONE: tokens, fonts, Sheet, Input, StatBlock and light mode (`c846472`, `ca9c004`, `91d9272`, `9274bc9`, `24e7c66`).
- ABANDONED: unified `Chart` with range toggle and tap-tooltip; Card `flat/raised/inset` variants (`Card.tsx` has no `variant`); app mark and illustrations.
- Motion tokens: DONE (`a360e5e`).

### DESIGN_SYSTEM.md (`34ea49c`, the stated "source of truth")

- **Stale when written.** Lines 33-35 say the scheme is "resolved at app launch … so a future live switch stays possible". The live switch had shipped 3 weeks earlier (`9024127`).
- Rule 1 says "reach for `Typo`". Only 2 files import `ui/Typo`; 59 import raw `Text`.
- Rule 2 says "never raw `TextInput`". Raw TextInput remains in `nutrition.tsx`, `settings.tsx`, `log.tsx`, `program-editor.tsx`, `FoodSearchSection.tsx` and `BlockForm.tsx`.
- Rule 6 says "TODO: respect reduced motion". 13 animated files already gate it. `focus.tsx`, `Button.tsx` and `Toast.tsx` animate with 0 reduce-motion references.
- Verdict: keep the doc but correct it. The rules are SWD.

### UI_OVERHAUL_TODO.md (`00a6732`, last synced `62664ce`)

- §1 tokens: DONE.
- §2 motion: PARTIAL. List staggers are done for schedule and nutrition (`3f3ff3c`), not Focus. The FAB now has reduce-motion (3 refs).
- §3 a11y: PARTIAL. Chart summaries are done (`854dcc7`); Dynamic Type, roles, contrast and VoiceOver are not.
- §4 perf, "virtualize long lists": not started. There are 0 FlatLists. `log.tsx` has manual pagination (`b762926`). SWD for the months-of-history goal.
- §5 / §9 copy: not started (low).
- §6 / §7: mostly `[x]`. Line 139 marks `TimelineSummary` as themed, but that component is dead code (§4).
- §10 pre-ship: tsc and eslint now pass. The rest is unverified.

### UX_OVERHAUL_BLUEPRINT.md

The quick wins and medium items are DONE:
- TimelineSummary removed from Focus (`2611aff`)
- persisted check-in dismissal (`DayCheckInCard.tsx:13,63`)
- Schedule rename and tab order Focus→Nutrition→Program (`(tabs)/_layout.tsx`)
- notifications (`c77dfb1`), onboarding (`9471f5f`), PR detection, weekly recap (`8526ad1`), empty states, FAB, IconButton

Remaining:
- Caffeine cutoff UI exists (`settings.tsx`). Units kg/lb are SWD (low); no match for `lb`.
- Meal notification "Mark eaten": SWD (it directly serves "logging takes almost no effort").
- Morning-recap and weekly-recap push notifications: SWD (only supplement and check-in categories exist).
- Long-term HealthKit / offline: see the strategy doc table.

### future.ignore.md (Rust/Axum backend + sync protocol)

- **OBSOLETE** as an architecture: the backend is Express/Prisma.
- Its *goals* (offline-capable, cache a working set, `version` in local schema, migrations, integration tests for sync, uptime monitoring) are still unmet and SWD.
- Device and mutation-log multi-device sync: OBSOLETE for a single-user app.

---

## 4. History, churn and dead code

**Evolution** (81 commits):

| When | What |
|---|---|
| 2026-02-05 | Vite web app plus Express backend (`2fb69b9`, 318 files); Render and Vercel deploy (`4d73488`) |
| 2026-02-17 | Expo app added in one 19k-line commit `d33e5ef` ("mobile") |
| 2026-06-11/12 | UX overhaul, workout logging, notifications, onboarding (`2611aff`…`d325492`) |
| 2026-06-13 | Product strategy, then a burst of roadmap features: seed, score spine, achievements, progression, insights, library |
| 2026-06-13/14 | Design-language redesign; light mode; live theme migration of every component |
| 2026-06-14 | Web app deleted (`5130b09`) |
| 2026-06-15/16 | Polish and a11y passes |
| 2026-07-04 | 20 commits in one day: backend hardening, vitest, offline queue, TanStack Query, refactors, 9 small features (barcode, quick add, plates…) |

Low-information messages: `d33e5ef "mobile"`, `42372f1 "improvements"` (20 files), `c4dfc04 "fix"`.

**Reverted or flip-flopped ideas**:
- Theme "resolved once at load" (`24e7c66`, 06-14) was replaced by the live toggle the same day (`3a73a82`→`9024127`). AGENTS.md and DESIGN_SYSTEM.md still describe the old model.
- AsyncStorage AppState cache (from the web localStorage era) was dropped for TanStack Query (`f2928c7`). The dead key remains in `storage.ts`.
- `(tabs)/more.tsx` was deleted in `2611aff`.
- TimelineSummary was removed from Focus (`2611aff`) but the file was kept and later re-themed (`b348dde`).
- `git log --grep=revert` matches only a "PR revert" wording in `d325492`. There are no `git revert` commits.

**Churn hotspots** (`git log --name-only`):

| Changes | File |
|---|---|
| 20 | `(tabs)/focus.tsx` |
| 18 | `(tabs)/nutrition.tsx` |
| 15 | `focus/WorkoutSection.tsx` |
| 12 | `(tabs)/settings.tsx` |
| 10 | `_layout.tsx`, `(tabs)/program.tsx` |
| 9 | `theme.ts` |
| 7 | `auth.controller.ts`, `MacroDashboard`, `DayCheckInCard`, `supplements.tsx`, `log.tsx` |
| 6 | `.claude/settings.local.json` (local tool config tracked in git) |

`focus.tsx` (652 lines), `nutrition.tsx` (653) and `program.tsx` (656) remain the largest files, together with `useWorkout.ts` (579).

**Dead code** (each verified by grep finding 0 references outside the defining file and tests):
- Files never imported: `components/focus/TimelineSummary.tsx` (59 lines) and `utils/formatting.ts` (22 lines; exports `parseRangeValue`, `formatTime`).
- Unused functions: `utils/haptics.warn`, `utils/normalize.formatMinutes`, `utils/nutrition.getGoalLabel`, `utils/trends.supplementStreak`, `constants.SEARCH_DEBOUNCE_MS`, `constants.MIN_SEARCH_LENGTH`.
- Test-only: `mutationQueue.pendingMutationCount`.
- Unused API wrappers: `foods.getFood/createFood`, `logs.getDailyLogs/getDailyLog/getLogStats`, `meals.getMealTemplates/updateMealGrams/getMealLogs`, `preferences.getPreferences`, `schedule.getScheduleBlocks/getCompletions`, `supplements.getSupplements/getSupplementLogs`, `sync.getFullState`, `client.getAccessToken`.
- Backend: `src/config/env.ts` (never imported).
- Storage: the `andi_weekday_os_*` keys.

---

## 5. Spread/rest ban: verdict **DROP**

Evidence:
- **Origin.** The identical rule is in the initial web (Vite) `eslint.config.js` of `2fb69b9` (rule at lines 29-39 and 68-78 of that file). It was carried into mobile. No RN or Hermes reason is recorded anywhere (`git log -S"no-restricted-syntax"` shows only `2fb69b9`, `d33e5ef` and `5130b09`).
- **Runtime.** Babel (babel-preset-expo) transpiles the source, and Hermes supports object spread and rest natively (RN 0.81 ships `node_modules/react-native/sdks/hermes-engine`). The app's own dependencies already ship spread: 49 occurrences in `expo-router/build/*.js` and 3 files in `@tanstack/query-core` build. There is no engine reason to avoid it.
- **Cost.** 73 `Object.assign(` calls in mobile. Every one starts with `{}` or a fresh literal (`grep` for a non-`{}` first argument finds only `auth.ts:51` and `client.ts:120`, both fresh literals), so no mutation-of-argument bugs exist today. But the ban forces workarounds:
  - `delete` on copies instead of rest-omit: `useCompletion.ts:88,100`, `useSupplements.ts:123`. The `delete (payload as Partial<…>).id` cast at `useCompletion.ts:100` erases type safety that `const { id, ...payload } = block` would keep.
  - Array `.concat([x])` instead of `[...a, x]` in 12 places.
  - A nested 3-level `Object.assign` for date-keyed maps (`useCompletion.ts:84-90`).
- **The rule is also incomplete.** It cannot see JSX spread (`JSXSpreadAttribute`), and the codebase has none, so it is purely stylistic.
- **Risk of dropping it.** Low. `Object.assign(target, …)` mutation is the main way this pattern goes wrong, and allowing spread removes the temptation.

Recommendation: delete the `no-restricted-syntax` block (`mobile/eslint.config.js:34-44`) and the "No spread" rule in AGENTS.md and DESIGN_SYSTEM.md rule 3. Migrate opportunistically.

---

## 6. Prisma: migrations drift and `db push` in production

**Confirmed drift.** The migrations folder has 5 migrations. `20260205165352_nmgrt` creates:
- `User` without `username`, `age`, `weight` (`migration.sql:2-10`)
- `MealTemplate` without `grams`, `foodId` (`:95-104`)
- `MealTemplateTag` with no `mealTemplateId` index (only the FK at `:308`)

No later migration adds them (grep across all `migration.sql` files for `"age"`, `"username"`, `"weight"`, `"grams"` and `MealTemplateTag_mealTemplateId_idx` returns nothing). `foodId` only appears for other tables. `schema.prisma` declares all of them (`:18-20`, `:146-148`, `:165`). The code depends on them:
- `auth.service.ts:25-27,184-194` (username, age, weight)
- `meals.service.ts:20-21,45-64` (grams, foodId)

**Production schema path.** `render.yaml:16` runs `npx prisma db push --skip-generate && npm start` on every boot. Prod was therefore shaped by `db push`, and `_prisma_migrations` likely does not reflect it. This is an inference: the prod DB could not be checked.

Risks:
1. **A fresh DB built from migrations is broken.** `prisma migrate deploy`, CI, `embedded-postgres` e2e or a new Render or Neon instance would produce a schema where register and meal-grams writes fail with unknown-column errors. `db:migrate` (`migrate dev`) on a dev DB would instead detect drift and offer to **reset** it.
2. **Schema changes happen at boot without review.** A destructive schema edit (dropping or renaming a column, adding a NOT NULL column without a default) makes `db push` refuse without `--accept-data-loss`, so the boot fails and the API is down. If someone adds that flag, data is silently dropped. Either way it happens on deploy, with no review step.
3. **Free-tier database.** `render.yaml:3` puts the DB on Render's free plan. The repo's own strategy doc flags "Render free DB expiry (recurring)" (`PRODUCT_STRATEGY_ANALYSIS.md:216`). There is no backup job in the repo. The only user-facing backup is `/sync/export`, which **omits** WorkoutSession, WorkoutSetLog, DailyScore, UserFood, custom GymProgram and UserPreferences (`sync.service.ts:276-288` reads only 7 tables). Months of training history therefore have no backup path.

Fix direction (for the follow-up, not done here):
- Generate a catch-up migration (`prisma migrate diff --from-migrations … --to-schema-datamodel`).
- Baseline prod with `migrate resolve --applied`.
- Switch the start command to `prisma migrate deploy`.
- Move the DB off the expiring free tier or add scheduled `pg_dump`.
- Extend export to all user tables.

---

## 7. Other outcome-relevant findings seen while mapping

These are on the evidence path but outside tasks 1–6.

**Workout sets are silently lost offline or during a cold start.**
- `startWorkoutSession(...).then(set sessionIdRef).catch(()=>{})` (`useWorkout.ts:268-273`). Every `logWorkoutSet` is skipped when `sessionIdRef` is null (`:326-348`), and individual set failures are swallowed (`.catch(() => {})`).
- Session state is in-memory only, so killing the app mid-workout loses the session.
- Impact: this directly undercuts "never loses data" and training-consistency measurement.

**Boot load grows without bound.**
- `/sync/export` returns every completion, supplement log, meal log and daily log since signup (`sync.service.ts:276-288`), plus 30 days of scores.
- Requests have no timeout, and Render's free tier cold-starts (`PRODUCT_STRATEGY_ANALYSIS.md:97`).
- Impact: "know what to do within 10 s" is at risk on the first open of the day.

**No offline read path.** The query cache is not persisted (§1), so offline open means an empty day (`appState = EMPTY_STATE`, `DataContext.tsx:137`).

**Score snapshots can be lost or wrong.**
- Snapshots are written only by an effect on Focus (`focus.tsx:265-283`), not queued, with failures ignored.
- Impact: months-long adherence history (streaks, insights) has gaps on days Focus is not opened late or the post fails.

**ErrorBoundary placement.** It does not wrap the providers (`_layout.tsx:92-93`), so a provider-level throw crashes the app.
