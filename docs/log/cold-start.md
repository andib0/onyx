# Cold start → interactive Today (Android release) — 2026-10-18

Goal: process start → interactive Today < 1.0 s on a mid-range Android release build.
**Not reached.** Best interleaved run: p50 985 ms (one variant, one session); the final
build measures p50 1026–1163 ms depending on host load, vs 1218–1226 ms for the
baseline in the same sessions. The 1 s line is roughly 465 ms of unavoidable floor
(blank Expo app) + ~100 ms of extra native init + ~500 ms of JS. Details below.

## Setup

- Emulator `onyx_pixel` (API 35, x86_64, 4 cores, 4 GB), Windows host with 16 GB. No physical
  device was available; every number here is from the emulator.
- Release APK from `scripts/android/build-release.ps1 -Name perf -ApiUrl http://10.0.2.2:3701/api`,
  local API (worktree backend, `onyx_dev` on :5442), e2e user signed in, and a realistic
  seeded day (3 blocks, 4 supplements, 2 meal templates per weekday, a program, 60 days of
  scores + daily logs).
- `npm run perf:tti` (`mobile/scripts/measure-tti.sh`): force-stop, `drop_caches` (root shell),
  `am start -W`, and every `ONYX_PERF` mark as ms since logcat `Start proc`. New marks this
  round: `bundle_start` (first app module, `mobile/index.ts` → `utils/perfBoot.ts`, before
  expo-router), `root_render`, `splash_hide`, `tabs_render`, `today_module`, `focus_complete`
  (below-the-fold Today content painted). Segment p50s are computed per run.
- **Interleaved A/B** (scratch runner): per round, install variant → one warm launch (writes
  the persisted cache) → N cold starts; rounds alternate variants. Sequential sessions
  drifted by 100–600 ms (emulator uptime, host load from other agents), so only numbers
  from the same interleaved session are compared.
- **Host noise is the dominant error bar.** Free RAM swung 1.2–8.6 GB during runs; the
  emulator was killed twice (adb "device offline", qemu gone) and its data wiped once
  (one A/B measured the login screen and was discarded). The old 2.3 s figure
  (docs/log/client-data.md) came from a degraded emulator: the same baseline APK measured
  1590 ms there before it hung, then 1043 ms after a fresh emulator boot.

## Floor: blank Expo SDK 54 app (create-expo-app blank@sdk-54, release, same emulator)

| | first JS line | interactive (first frame after mount + rAF) |
|---|---|---|
| fresh emulator (12 runs) | 378 / 423 | **465 / 495** (p50 / p90) |
| degraded emulator (12 runs) | 726 / 843 | 840 / 927 |

Onyx's budget above the floor is therefore ~535 ms on a fresh emulator.

## Where the time goes (final A/B session, 15 cold runs each, p50 of per-run deltas, ms)

| segment | baseline (main) | final | notes |
|---|---|---|---|
| process start → `bundle_start` (native: zygote, bindApplication, dex, SoLoader, RN host, Hermes, bundle mmap) | 589 | 564 | blank app: 378 |
| → `js_start` (`_layout` module body) | 145 | 41 | inline requires: imports now evaluate on first use (cost moves later, see below) |
| → `root_render` (expo-router store, getRoutes, NavigationContainer, initial URL) | 33 | 95 | lazily-required modules land here |
| → `fonts_loaded` | 18 | 7 | fonts embedded natively; no runtime load |
| → `cache_restored` / `auth_ready` | 42 / −3 | 2 / 0 | disk reads prefetched at module load |
| → `splash_hide` → `tabs_render` → `today_module` | 14 / 16 / 11 | 19 / 25 / 72 | Today's module graph evaluated on first use |
| → `focus_first_render` (first commit with data: providers, stack, tabs, Today) | 269 | 217 | |
| → `focus_interactive` (next frame) | 110 | 83 | |
| → `focus_complete` (below-the-fold cards painted) | – | 91 | |
| **focus_interactive p50 / p90** | **1221 / 1345** | **1163 / 1237** | host 3.8 → 1.9 GB free during the run |
| `am start -W` TotalTime p50 | 935 | 820 | |

Same build in airplane mode (8 runs, host 1.9 GB free): focus_interactive 1303 / 1407 —
Today renders from disk; network stays off the critical path.

### Native (atrace of one cold start, baseline, drop_caches, tracing overhead included)

`bindApplication` 1009 ms: `OpenDexFilesFromOat` 493 (25.4 MB of dex in 3 files, install
status `verify` = interpreted/JIT), `SoLoader` libreactnative 245 + libappmodules 98, then
`ReactInstance.initialize` 285 (TurboModules 115 incl. Expo module registry — BlurModule 29,
FileSystem 10 — Fabric 110), JS thread: expo-modules JSI install, `FileSystem.jsObject` 57,
`ExpoCamera.jsObject` 25. After the first frame WebView is initialised on an OkHttp thread
(137 ms, off the critical path).

### JS (React Profiler, profiling renderer, one diag build; not committed)

- The first commit with data is ~105–175 ms of render (whole provider tree + stack + tabs +
  Today; Today's own hooks are < 1 ms, `ScreenContainer` subtree 55–77 ms, NutritionBars
  10–19, DayStatusCard 6–21, tab bar + navigators ~50).
- After it React Navigation re-renders the tab tree once more ("nested-update", 36–45 ms)
  with no changed inputs for Today, then several 1–8 ms commits (icon font load, etc.).
- `Linking.getInitialURL()` (expo-router's Android path) resolves in 3–6 ms — not a cause.

## Experiments (each measured in an interleaved session; p50 / p90 focus_interactive, ms)

| # | change | result | kept? |
|---|---|---|---|
| 0 | instrumentation only (`index.ts` entry, new marks) | baseline | yes |
| 1 | Metro `inlineRequires` (native only) | ab-1: 1218 → 1142 (base vs inline); fresh single runs 1043 → 1012. `js_start` moves 140 ms earlier but most of the work moves into `root_render`/`today_module` — the startup graph is needed anyway | yes (small win) |
| 2 | embed Archivo/JetBrains Mono via expo-font config plugin (no runtime load, providers mount on the first render) | ab-1: 1149 (fonts) vs 1142 (inline) — neutral on time, removes a render pass | yes |
| 3 | prefetch session + persisted-cache reads at module load; Today mounts the below-the-fold review cards after the first painted frame (`useAfterFirstPaint`) | ab-1: 1168; ab-3: base 1226 → **1026 / 1102**. cache/auth ready ~40 ms earlier; below-fold costs ~90–150 ms after the first frame instead of before it | yes |
| 4 | R8 minify + resource shrinking (config plugin in `app.config.ts`) | dex 25.4 → 10.6 MB, APK 41.6 → 36.4 MB; ab-3: **985 / 1156** (process → first JS line −38 ms vs #3) | yes |
| 5 | Ionicons embedded as Android font asset `ionicons` (config plugin copies it at prebuild) | ab-3: 1045 / 1122 (neutral within noise); icons now draw in the first frame instead of after `Font.loadAsync` + one re-render per icon | yes (correctness of first frame) |
| 6 | `React.memo` on the Today screen (skip the post-mount tab re-render) | ab-4 (partial, emulator died): 1282 / 1433 (n=5) vs #5 1053 (n=5) — no evidence of gain | **reverted** |
| – | `inlineRequires` on web | broke the Playwright smoke (react-native-worklets JS-worklets init depends on eager module order) | web excluded |

Final = 1–5. Final interleaved session: **1221 / 1345 → 1163 / 1237** (n=15 each, loaded
host); best session (ab-3, fresh emulator): **1226 / 1320 → 985–1045 / 1102–1156**.

R8 check: Maestro smoke over Today, Train, Eat, Progress, Quick log, Settings on the
minified release build — no crash, fonts and icons render
(`maestro test` with a scratch flow; screenshots inspected).

## What blocks < 1 s (on this emulator)

1. **Floor ≈ 465 ms** for a blank Expo SDK 54 release app (378 ms before the first JS line).
2. **Native extra ≈ 110–190 ms** over the floor before JS runs: 3 dex files (10.6 MB after
   R8), ~25 Expo/RN native modules registered eagerly (expo-camera, blur, file-system,
   notifications, reanimated/worklets, svg, screens …) and their `.so` loads. Only fewer
   native modules or a Play-installed baseline/cloud profile (adb installs stay at
   `verify`) would cut this; not something a JS change reaches.
3. **JS ≈ 500–600 ms** after the first line: expo-router + React Navigation setup (~100 ms),
   evaluating the route/provider module graph (~70 ms even when lazy), one ~200 ms first
   commit of ~10 context providers + Stack + Tabs + Today, React Navigation's post-mount
   re-render (~40 ms), and the frame. Getting this under ~400 ms needs structural work, not
   tweaks: a lighter provider tree for the first frame (e.g. a Today-only snapshot view
   rendered before the full domain providers mount), or replacing the nested Stack+Tabs
   navigators on the cold path.

Emulator vs mid-range phone: the x86_64 emulator runs on a desktop CPU with host-backed
storage; a mid-range ARM phone (e.g. Snapdragon 6-series) is typically slower on JS and
faster on nothing here, so expect the phone to land above these numbers. Play installs
get profile-guided AOT, which the adb-installed emulator build does not.

## Also changed

- `scripts/android/build-release.ps1`: stamps `api/client.ts` in the build copy with the API
  URL (Metro's shared transform cache served a `:3301` URL to a `:3701` build), and runs
  gradle with `--no-daemon` (a daemon inherited redirected stdout, so `build-release.ps1 *> log`
  never returned, and kept ~2 GB).
- `npm run perf:tti` takes an optional label, prints Displayed + segment p50/p90 and host RAM.
