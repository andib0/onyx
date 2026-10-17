# 07 — Performance Audit (mobile cold start, bundle, render cascades)

Date: 2026-10-17 · Scope: `mobile/` (Expo SDK 54, RN 0.81.5, React 19.1, Hermes, New Arch, Expo Router 6, TanStack Query 5, Reanimated 4.1). Backend is covered only where it sits on the startup critical path.
Target: **cold start → interactive Focus screen in < 1.0 s on a mid-range Android release build.**

Method: `npx expo export --platform android` (Hermes and `--no-bytecode` variants, both with `--dump-sourcemap`), a zero-dependency source-map attribution script, a static read of the startup path, and a structural render-count harness (react-test-renderer 19.1) that models the provider tree. **No Android device or emulator was available, so every timing below is an estimate (marked ≈) and not a measurement.** §4 sets up the machinery to replace the estimates with real numbers.
Scratch evidence: `%TEMP%\claude\C--Users-andi-Desktop-Personal-daily\b8fd86a4-…\scratchpad\perf\` (`export-android/`, `export-android-js/`, `bundle-top.txt`, `bundle-attribution.json`, `render-harness/out-*.txt`, `scripts/`).

> The working tree was being edited by other agents during the audit (`mobile/api/client.ts` → `api/tokenStore.ts`). Line numbers refer to the working tree at about 18:40.

---

## TL;DR — verdict on the < 1 s target

**The target cannot be reached with the current architecture, whatever the bundle tuning.** Focus cannot show anything until **three sequential network round trips** finish: `/auth/refresh` → `/auth/me` → `/sync/export`. The backend is on Render's **free plan**, which sleeps when idle. So the first open of the day takes **≈30–60 s**, and a warm open takes **≈1.0–2.8 s**. **No app state is cached on device** (the AsyncStorage cache described in AGENTS.md no longer exists). The device's own work is roughly 0.45–0.9 s ≈, which fits the budget once the network leaves the critical path.

| # | Blocker | Evidence | Fix (priority) |
|---|---------|----------|----------------|
| B1 | Session restore blocks all rendering on 2 sequential network calls | `contexts/AuthContext.tsx:43-75` (`:58` refresh, `:61` me); `app/_layout.tsx:28-34` spinner | P0: restore optimistically from SecureStore plus a cached `user`, render right away, and refresh in the background |
| B2 | Focus blocks on `/sync/export` (full history, unbounded) | `app/(tabs)/focus.tsx:335`; `contexts/DataContext.tsx:105-115`; `backend/src/services/sync.service.ts:278-288` (no `take`/date filter) | P0: persist the TanStack Query cache (AsyncStorage persister) and render from cache first. Switch to bounded `/sync/state` (`:378-393`, today only) |
| B3 | Free-tier backend sleeps → 30–60 s first request | `backend/render.yaml` `plan: free` | P0 with B1/B2: cache-first hides it; or paid plan / keep-alive |
| B4 | `/auth/refresh` is CPU-heavy: N × `bcrypt.compare` + 1 `bcrypt.hash` on every launch (bcryptjs cost 10 = **≈75 ms per op measured on the desktop**, several times slower on free-tier CPU) | `backend/src/services/auth.service.ts:107-150`; see also 03-security F6 | P1: skip refresh while the 15-min access token is still valid; refresh lazily on 401 (already supported by `api/client.ts`) |
| B5 | Fonts gate the first render (4 TTFs, 471 KB, loaded at runtime) | `app/_layout.tsx:71-84` | P1: embed the fonts at build time through the `expo-font` config plugin (`app.json` lists the plugin with no `fonts`), and hold the native splash screen instead of a JS spinner |
| B6 | Barrel imports evaluate **all 19 icon sets plus ≈545 KB of glyph-map JSON** at startup, and ship 53 font files (8.2 MB) | `@expo/vector-icons` main = `build/IconsLazy.js`, which `require`s every set eagerly (`:121+`); 19 files import `{ Ionicons } from "@expo/vector-icons"` | P1: `import Ionicons from "@expo/vector-icons/Ionicons"`; `@expo-google-fonts/archivo/700Bold` style deep imports |
| B7 | Every context change re-renders the whole provider chain and Focus (13 components); 2× per second during a workout | §3 | P2 (it doesn't hurt cold start, but it does hurt the workout screen) |

---

## 1. Bundle size

Command: `npx expo export --platform android --output-dir …/export-android --dump-sourcemap` (Hermes). A second run used `--no-bytecode` to get a minified JS bundle that can be attributed. Export metadata: 1 bundle, 77 assets.

| Artifact | Size |
|---|---|
| **Hermes bytecode** `entry-254aa829….hbc` | **3,459,736 B (3.46 MB)** |
| Minified JS (no bytecode) `entry-83592a77….js` | 3,710,302 B (3.71 MB); gzip 908,331 B |
| Source map (JS) | 11.9 MB, **1,971 source modules** |
| Assets | **77 files, 8,240,043 B (8.24 MB)** |
| of which Google-font TTFs | **34 files ≈4.14 MB**; only 4 are used |
| of which vector-icon TTFs | **19 files ≈4.08 MB**; only Ionicons (390 KB) is used |

Attribution (`scripts/analyze-sourcemap.mjs`; 2.96 MB attributed to files. Most of the 665 KB that could not be attributed is JSON modules that have no mappings, mainly **icon glyph maps ≈545 KB on disk**: MaterialCommunityIcons 212 KB, FontAwesome6 95 KB, MaterialIcons 54 KB, Ionicons 35 KB, …).

**Top 25 packages**: react-native 680.8 KB (18.8%) · **react-native-reanimated 658.3 KB (18.2%)** · app source 285.9 KB (7.9%, 133 files) · expo-router 140.7 · react-native-gesture-handler 110.6 · react-native-svg 109.0 · expo 83.0 · @react-navigation/core 77.1 · @tanstack/query-core 71.8 · react-native-worklets 66.2 · @react-native/virtualized-lists 52.3 · react-native-screens 41.8 · whatwg-url-without-unicode 38.2 (expo URL polyfill) · expo-notifications 36.1 · @react-navigation/elements 34.8 · **assert 29.0 (pulled in by expo-notifications)** · @expo/vector-icons 24.2 (*plus ≈545 KB of glyph-map JSON*) · @react-navigation/bottom-tabs 21.2 · buffer 20.4 · @react-navigation/native 19.8 · native-stack 17.9 · semver 17.4 · @react-navigation/routers 17.1 · @tanstack/react-query 16.3 · expo-modules-core 14.0.

**Top 25 modules (files)**: ReactNativeRenderer-prod 117.7 KB · ReactFabric-prod 115.3 · expo/virtual/streams 62.7 · VirtualizedList 27.1 · reanimated `defaultAnimations/Zoom` 23.3 · reanimated `animation/util` 20.7 · buffer/index 20.4 · reanimated `Flip` 19.0 · reanimated `Colors` 19.0 · reanimated `index` 18.1 · reanimated `Bounce` 17.8 · reanimated `matrixUtils` 16.8 · reanimated `spring` 16.2 · whatwg-url `url-state-machine` 15.9 · reanimated `Rotate` 14.7 · reanimated `Fade` 14.1 · ScrollView 14.0 · reanimated `useAnimatedStyle` 13.9 · ReactNativeFeatureFlags 13.0 · reanimated `springUtils` 12.9 · reanimated `styleAnimation` 12.8 · reanimated `interpolateColor` 12.7 · reanimated `Easing` 12.4 · query-core `queryObserver` 12.1 · worklets `serializable` 12.0. (Full list: `scratchpad/perf/bundle-top.txt`.)

Largest app modules: `app/(tabs)/nutrition.tsx` 11.9 KB, `program.tsx` 10.8, `focus.tsx` 9.8, `log.tsx` 9.1, `settings.tsx` 7.8, `components/focus/WorkoutSection.tsx` 7.8, `hooks/useWorkout.ts` 7.6.

**Heavy dependencies at startup:**
- **@expo/vector-icons barrel**: `(tabs)/_layout.tsx:4` and `focus.tsx:5` import `{ Ionicons } from "@expo/vector-icons"`. The package `main` is `build/IconsLazy.js`, which despite its name `require`s all 19 icon sets at module eval (`IconsLazy.js:121-139`). So ≈545 KB of glyph-map object literals run during startup, and all 19 TTFs ship in the APK. **Estimated 10–40 ms of JS init plus 3.7 MB of wasted assets.**
- **@expo-google-fonts barrels**: `app/_layout.tsx:6-14` imports from the package roots. Each `index.js` `require`s every weight (18 Archivo + 16 JetBrains), so 34 TTFs ≈4.1 MB are bundled when 4 are used. Only APK size and asset extraction are affected; the runtime load is still the 4 fonts.
- **expo-notifications** (36 KB, plus `assert`/`util`/`get-intrinsic` polyfills ≈50 KB) loads eagerly through `components/NotificationResponder.tsx:2` (mounted by the tabs layout) and `utils/notifications.ts` (imported by `AppStateContext.tsx:12` and `hooks/useWorkout.ts:8`).
- **expo-camera** (8 KB JS) is **not** on the startup path. It is only imported by `components/nutrition/BarcodeScannerSheet.tsx:3` ← `app/(tabs)/nutrition.tsx:44`, and Expo Router loads leaf routes lazily in production (`expo-router/build/getRoutesCore.js:303-306`: only dev with `importMode==='sync'` loads all routes eagerly; layouts are loaded eagerly at `:620`). Its native module is still registered at process start.
- **Reanimated layout animations** (Zoom/Flip/Bounce/Rotate/Fade ≈90 KB) are all bundled because `focus.tsx:7` imports from the `react-native-reanimated` root. Bytecode cost only; acceptable.
- Charts are hand-rolled with react-native-svg (109 KB). There is no date library (good).
- `@expo/metro-config` sets `inlineRequires: false` (`ExpoMetroConfig.js:322`), and there is no `metro.config.js`. So **every module statically imported from `app/_layout.tsx` runs before the first frame.** That includes all 10 contexts, their hooks, every `api/*` wrapper, `utils/notifications`, and `utils/normalize`.

---

## 2. Startup critical path (`app/_layout.tsx` → `index.tsx` → `(tabs)/focus.tsx`)

There is no `SplashScreen.preventAutoHideAsync()` anywhere (`grep SplashScreen app components` → none). The native splash therefore hides at the first JS frame, and the user sees **splash → spinner (fonts) → spinner (auth) → Focus `LoadingScreen` (state) → content**: three loading states in a row.

| Step | What happens | Gates Focus? | ≈ cost (mid-range Android, release) |
|---|---|---|---|
| 0 | Process start, `Application.onCreate`, Expo module registry (≈20 native modules incl. camera, notifications, secure-store) | yes | 150–300 ms ≈ |
| 1 | RN host + Fabric init, Hermes maps the 3.46 MB HBC | yes | 100–200 ms ≈ |
| 2 | JS module init of the eager graph (`inlineRequires:false`; contexts, api, notifications, **all 19 icon sets plus glyph maps**) | yes | 60–180 ms ≈ |
| 3 | `RootLayout` render #1 → `useFonts` loads **4 font files / 2 families × 2 weights** (Archivo 700/800, JetBrains Mono 500/700; 471 KB) → spinner (`_layout.tsx:71-84`) | yes | 30–120 ms ≈ |
| 4 | Provider tree mounts: QueryClient → Theme → Auth → AppState (Toast → Program → DataBridge → Data → Schedule → Meals → Supplements → Inner → Timeline). `RootStack` shows spinner #2 while `isLoading` (`_layout.tsx:28-34`) | yes | 10–30 ms ≈ |
| 5 | **SecureStore × 2, sequential**: access token (`AuthContext.tsx:47`) then refresh token (`:50`), each an Android Keystore decrypt | yes | 20–80 ms ≈ |
| 6 | **POST `/auth/refresh`** (`AuthContext.tsx:58`): TLS handshake, then server findMany + N×bcrypt.compare + findUnique + deleteMany + bcrypt.hash + create (`auth.service.ts:107-150`). **Always runs, even when the access token is still valid** | yes | 300–900 ms ≈ warm; **30–60 s when the Render free instance is asleep** |
| 7 | **GET `/auth/me`** (`AuthContext.tsx:61`), sequential after 6 | yes | 100–300 ms ≈ |
| 8 | `index.tsx:7-11` `<Redirect>` → tabs layout (eager `NotificationResponder` → `registerNotificationCategories`) → Focus mounts → `if (stateLoading) return <LoadingScreen/>` (`focus.tsx:335`) | yes | 20–60 ms ≈ |
| 9 | **GET `/sync/export`** (`DataContext.tsx:105-115`) returns **all** schedule/supplement/meal templates plus **all-time** dailyLogs, completions, supplementLogs and mealLogs (`sync.service.ts:278-288`), then `normalizeState` | yes | 150–600 ms ≈, **grows linearly with history** |
| 10 | Focus content render (652-line screen; 0 `React.memo` anywhere in `app/` or `components/`) plus entering animations (`FadeInDown` 400 ms, `ZoomIn` 150+450 ms, `focus.tsx:358,366,411`) | interactive after the render; visually settled ≈600 ms later | 50–150 ms ≈ |
| | **Total, warm backend** | | **≈1.0–2.8 s** |
| | **Total, sleeping backend** | | **≈30–60 s** |

Off the critical path but competing for the JS thread and network during the same window:
- Network after auth (parallel): `/scores?days=30` (`DataContext.tsx:117`), `/programs` (`hooks/useProgram.ts:23`), **`PUT /preferences` on every launch**, which writes back the values it just read (`useProgram.ts:47-53`, fires when `prefsReady` flips), `/programs/:id` (`useProgram.ts:63`, after `/me`), and `flushMutationQueue` (`DataContext.tsx:92`).
- **≈10 single-key AsyncStorage reads**: theme mode (`ThemeContext.tsx:42`), workout-done flag (`useWorkout.ts:120`), notification prefs (`useWorkout.ts:154`, and `AppStateContext.tsx:24` on every `supplementsList` identity change, which is at least 2× at startup: EMPTY, then loaded), mutation queue (`utils/mutationQueue.ts:34`), 3 dismiss keys (`focus.tsx:303-306`), plus whichever contextual card renders (`DayCheckInCard.tsx:49` / `GettingStartedCard.tsx:32` / `WeeklyRecapCard.tsx:68`), and `useWater.ts:11` on Nutrition. One `multiGet` would replace all of them.
- `syncSupplementReminders` reschedules every supplement notification each time `supplementsList` changes identity (`AppStateContext.tsx:23-29`), so at least twice per cold start.
- The theme mode loads asynchronously (`ThemeContext.tsx:42`), so a user with an explicit light/dark override sees a re-render (and possibly a flash) after the first frame.

**AsyncStorage hydration size: 0 bytes of app state.** `utils/storage.ts` keeps the `andi_weekday_os_v1` key names only for `clearStorage()`; nothing writes or reads the state blob any more. The cache is the in-memory TanStack Query cache, with no persister. AGENTS.md ("cached in AsyncStorage under key `andi_weekday_os_v1`") is out of date.

**Tab screens are not eagerly imported.** Leaf routes load lazily in production and bottom tabs mount lazily, so Nutrition/Program/Schedule/Settings code does not run at cold start. Their bytecode is still in the single HBC, which is mmapped, so the cost is small.

**Offline cold start**: if `/auth/refresh` fails (offline, or the server asleep past the fetch timeout), `user` stays `null`, so `isAuthenticated=false` and `index.tsx:8` redirects to **login** even though valid tokens are stored. That is a correctness bug and a startup bug at the same time. Note also that `authApi.refreshToken()` posts **no body** (`api/auth.ts:85`) and depends on the OkHttp cookie jar. The refresh token in SecureStore is only sent by the 401 path in `api/client.ts`.

### Path to < 1 s (ordered by impact)
1. **Cache-first render (B1+B2+B3).** Add `@tanstack/query-async-storage-persister` with `PersistQueryClientProvider` (maxAge 7 d, `buster` = app version). Persist `["appState"]`, `["scores"]` and a `["me"]` query. In `AuthContext`, treat "refresh token exists plus cached user" as authenticated right away and set `isLoading=false` after the SecureStore read. Revalidate in the background, and only log out on an explicit 401 from refresh. Focus should gate on `!data`, not on `isLoading` (`focus.tsx:335`). Expected: network removed from the critical path. **≈ −1.0 to −2.5 s warm, −30 to −60 s cold-server.**
2. **Bounded state endpoint**: use `/sync/state` (today plus 100 logs, `sync.service.ts:378-393`) for boot. Fetch history for Insights/Log on demand.
3. **Skip `/auth/refresh` at boot** when the stored access token has more than 60 s of `exp` left (decode the JWT locally). Then `/auth/me` and `/sync/state` can run in **parallel**.
4. **Native splash and build-time fonts**: call `SplashScreen.preventAutoHideAsync()` at module scope in `_layout.tsx`, and call `hideAsync()` from Focus's first data render (cached). Embed the 4 TTFs plus Ionicons with `["expo-font", { fonts: [...] }]` and drop `useFonts`. Removes 1–2 JS spinners and ≈30–120 ms.
5. **Deep imports**: `@expo/vector-icons/Ionicons` (19 files), and per-weight `@expo-google-fonts/*` paths. Saves ≈545 KB JS JSON, 7.8 MB of assets, and ≈10–40 ms init.
6. Merge the startup AsyncStorage reads into one `multiGet`. Drop the boot-time `PUT /preferences` (only write when a value changes after `prefsReady`).
7. Optional: `inlineRequires: true` with a custom `metro.config.js` to defer `expo-notifications`, `utils/achievements` and `api/*` until first use. Measure before and after with §4.

Projected after 1–5 (≈, unverified): process + RN init 250–500 ms, JS init 40–120 ms, persisted-cache read plus parse 20–60 ms, first Focus render 50–150 ms → **≈0.45–0.85 s**, inside the budget.

---

## 3. Render counts and re-render cascades

### Static findings
- **Context values are rebuilt inline on every render** (new object identity each time): `AuthContext.tsx:162` (plain object, no `useMemo`), `ToastContext.tsx:17`, `ProgramContext.tsx:65`, `DataContext.tsx:183`, `ScheduleContext.tsx:46`, `MealsContext.tsx:52`, `TimelineContext.tsx:120`. Only `ThemeContext.tsx:72` is properly memoized. `SupplementsContext.tsx:58` uses `useMemo`, but its dependency `supplements` is the return object of `hooks/useSupplements.ts`, which is new on every render (that hook has 0 `useMemo`/`useCallback`, and so do `useMeals`, `useCompletion`, `useLog` and `useImportExport`). The memo therefore never hits.
- **The provider chain is wired by props.** `DataProviderBridge` (`AppStateContext.tsx:81`) consumes all of `useProgram()`. `DataProvider` consumes `useAuth()` and `useToastContext()` (`DataContext.tsx:64-65`). `DomainProviders` (`:50`) rebuilds Schedule/Meals/Supplements elements from `useData()` and `useToastContext()`. `InnerProviders` (`:18`) rebuilds the Timeline from 4 contexts. So any change in Toast, Program or Data cascades through **every** provider below it.
- `showToast` is a new function on every render (`hooks/useToast.ts:30`). Because it is a prop of every domain provider, a toast re-renders everything twice: once on show and once on auto-hide.
- **Workout ticker**: `useWorkout.ts:175` calls `setNow` every **500 ms** while a workout is active. `workout` is a fresh object (`useWorkout.ts:548`) inside ProgramProvider, so the whole tree re-renders **2× per second** for the length of the session. That includes the 652-line `FocusScreen`, which recomputes `buildYesterdayRecap`, `scoreStreak` and the filter/map chains (`focus.tsx:209-227`) on each tick.
- **Other timers**: `useNow` 60 s, which has two separate instances: `TimelineProvider` via `useToday`, and `FocusScreen` via `useActiveContext`. They are not aligned to the minute boundary, so the displayed "now" can lag by up to 59 s. Also `DataContext.tsx:76` (todayKey, 60 s, this one bails out correctly) and `DataContext.tsx:93` (queue flush, 60 s).
- **`useAppState()` shim** (`AppStateContext.tsx:112`) subscribes to all 7 contexts. Only `app/log.tsx:93` and `app/supplements.tsx:46` use it. Because stack screens stay mounted underneath, those screens also re-render on every workout tick and toast while they are open.
- `TabLayout` (`(tabs)/_layout.tsx:13-14`) consumes Meals and Supplements to compute the badge, so the tab navigator re-renders on every data or toast change.
- **0 uses of `React.memo`** in `app/` and `components/`. Every child of a re-rendering screen re-renders too.

### Measured (structural harness, `scratchpad/perf/render-harness/harness.mjs`)
The harness copies the real provider topology and memoization behaviour of `contexts/*` (react-test-renderer 19.1, `act`) and counts renders of providers plus the consumers mounted at cold start (TabLayout, NotificationResponder, FocusScreen, and FocusScreen's child cards).

| Event | Components re-rendered (current) | With memoized values + stable `showToast` |
|---|---|---|
| Auth restored | 18 (everything) | 18 |
| workout-done flag / programs list / program detail resolve | **13 each** | 7 |
| `/sync/export` resolves | 11 | 11 |
| `/scores` resolves | 11 | 9 |
| `showToast()` and its auto-hide | **13 + 13** | 11 + 11 |
| **Workout tick (every 500 ms)** | **13 → 26 renders/s** | 7 → 14 renders/s |
| Meal check (`setAppState`) | 11 | 11 |
| `useNow` minute tick | 3 | 3 |
| Cold start cumulative | FocusScreen ×6, DataProvider and every domain provider ×7 | FocusScreen ×6, Schedule/Meals/Supps ×4, TabLayout ×2 |

Takeaway: `useMemo` on the values alone is not enough. The structural fixes are:
1. Move the workout into its own `WorkoutContext`, consumed only by `WorkoutSection` and the active-set UI.
2. Give `DataProviderBridge` a narrow selector (or pass `resetProgram` through a ref).
3. Use a stable `showToast` (`useCallback` plus refs) and split the toast *state* from the toast *dispatcher*, so that `DataProvider` doesn't subscribe to the message.
4. `useMemo` every provider value, and `useCallback` the hook mutators.
5. `React.memo` the Focus cards (`WorkoutSection`, `ProteinCard`, `ChecklistSection`, `FocusBlockPanel`, `InsightsTeaserCard`).
6. Delete `useAppState` once `log.tsx`/`supplements.tsx` are migrated.

---

## 4. Measurement machinery (drafts in `scratchpad/perf/scripts/`, not applied to the repo)

| Script | Purpose |
|---|---|
| `measure-tti.sh [runs] [pkg]` | Cold-start loop: `am force-stop` → (drop caches if root) → `logcat -c` → `adb shell am start -W -S -n com.onyx.daily/.MainActivity` (records `TotalTime` = first Android frame) → waits for the JS marks in logcat (`ReactNativeJS` tag) → CSV plus p50/p90. Budget: `focus_interactive` p50 < 1000 ms. |
| `perf-marks.ts` | Proposed `mobile/utils/perfMarks.ts`. `perfMark()` uses `performance.now()` (Hermes, ms since runtime start) and logs `ONYX_PERF <name> <ms>`. Wire-up: `js_start` (`_layout.tsx` module top), `fonts_loaded`, `auth_ready` (`AuthContext` `finally`), `focus_first_render` and `focus_interactive` (Focus effect plus `InteractionManager.runAfterInteractions`). Can be swapped for `react-native-performance` marks later. |
| `check-bundle-budget.mjs` | CI gate: runs `expo export --platform android` and fails if HBC > 3.65 MB, assets > 8.7 MB / 80 files, or font assets > 40. Fonts are detected by TTF/OTF magic bytes. Baselines are recorded above. After the B6 fix, lower the limits to roughly HBC 3.0 MB, assets 1.5 MB, fonts 5. |
| `analyze-sourcemap.mjs` | Zero-dependency `source-map-explorer` equivalent: top N files and packages from bundle + map, with optional `--json`. Use it with `--no-bytecode --dump-sourcemap` exports. |
| `render-count.tsx` | Proposed dev-only `useRenderCount(name)` and `<RenderProfiler id>` (React `Profiler`). Every 5 s it logs `RENDERS FocusScreen=… DataProvider=…`. It is a no-op in release builds (`__DEV__`). |
| `render-harness/harness.mjs` | Node model of the provider tree (`node harness.mjs` / `node harness.mjs memo`). Re-run it after refactoring contexts to confirm the cascade is gone. |

Recommended protocol, once the emulator or device is up:
1. Build a release APK (`npx expo run:android --variant release`, or an EAS `preview` profile).
2. Run 10 runs × 3 scenarios: (a) warm backend, (b) after > 15 min idle (Render asleep), (c) airplane mode.
3. Record `TotalTime`, each mark, p50 and p90.
4. Optionally record a Hermes sampling profile (`adb shell am start … --es "hermes.profile" …` or the React Native DevTools profiler on a release-profile build) for the JS-init slice.
5. Add Android Studio's *App Startup* / Perfetto trace (`adb shell perfetto -o … -t 10s am wm view gfx sched`) for the native slice.

"Mid-range" reference: a Pixel 4a / Galaxy A54-class device. An x86_64 emulator gives relative numbers only.
