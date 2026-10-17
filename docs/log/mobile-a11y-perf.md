# Mobile a11y + perf (Bets 10 & 11) — 2026-10-17

Branch `worktree-agent-a55d8f73cabdb635a` (fast-forwarded to `main` 3275a4e first).
Judges per commit, in `mobile/`: `tsc --noEmit`, `eslint .`, `prettier --check .`,
`vitest run` (10 files / 58 tests green), `npm run perf:bundle` (pass).

## Before → after

| Metric | Before | After | Evidence |
|---|---|---|---|
| Contrast pairs failing (both palettes, 210 declared) | **75** (21 dark, 54 light) | **0** | `theme/__tests__/contrast.test.ts` |
| Touchables without `accessibilityRole` | **38** | **0** | `components/__tests__/touchables.a11y.test.ts` (TypeScript AST over app/ + components/) |
| Glyph/backdrop touchables without label | **2** (+ Stepper −/+, MyFoods "x", log "x" announced as glyphs) | **0** | same |
| Control classes under 44 pt | **9** (Button sm, ChipSelector, gram presets, tier chips, food Add/Save, My-Foods Add/x, library Add, Clear Checks, Checkbox, Segmented) | **0** (minHeight or hitSlop to ≥ 44) | audit 06 §5.2 table |
| Hermes bytecode | 3,461,852 B | **3,121,856 B** (−340 KB) | `npm run perf:bundle` |
| Export assets | 8,240,043 B / 77 files / 53 fonts | **883,283 B / 29 files / 5 fonts** | same |
| Consumers re-rendered per toast (show + hide) | 5 + 5 | **0 + 0** | `contexts/__tests__/renderCounts.test.tsx` |
| … per programs-list load | 6 | **2** (Focus + workout card) | same |
| … per meal check | 5 | **4** (Schedule no longer) | same |
| … per workout tick | 6 | **2** (only `useProgram()` consumers) | same |

The audit's "13 components per event" counted providers too; this harness counts the six
screen-shaped consumers (Focus, workout card, TabLayout, Schedule, Settings, Nutrition) with
the real provider tree mounted.

## Changes

**Contrast / theme (`mobile/theme.ts`)** — light: `muted` .64→.70, `faint` .45→.62,
`accent` #2f5bd8, `accent2` #2457e6, `good` #0b734b, `warning` #8c5a00, `danger` #bf312a,
`supplement` #077166, `timeSun` #b86304, tag Sleep #7c4ff0 / Recovery #d8317f. Dark:
`faint` .40→.50, `accent` #6b93ff, `danger` #ec6f66, `onFill` → dark ink #0b0f14 (white on
green/teal/amber was 1.9–2.1:1). New tokens `controlBorder` (white .36 / slate .48; checkbox
outline, inputs, stepper) and `focusRing` (= accent). Tints follow the new hues.
`TAG_COLORS` (module-load palette) replaced by `getTagColors(palette)` / `tagColor(tag, palette)`;
`sharedStyles` became `getSharedStyles(colors)`; greeting icon and Burst read the live palette.
`app.json` `userInterfaceStyle: "automatic"`; the ThemeContext toggle still overrides.
Camera hint on the barcode sheet is literal white (sits on video, not a surface).

**Semantics** — roles/labels on 31 text touchables (radio + checked state on program cards,
selected state on day/tier/gram chips, names in Add/Save/Remove labels), Stepper −/+
("Decrease KG") and its input label, backdrops ("Close sheet"/cancel label), ConfirmModal's
inner tap-swallower `accessible={false}` (it was grouping both buttons into one stop),
Checkbox `decorative` inside labelled rows (single focus stop) and `label` when standalone,
Input `accessibilityLabel`, Toast `alert` + live region. Reduced motion: Focus entrances and
Toast (fade instead of slide). `maxFontSizeMultiplier` 1.2–1.4 on Ring, StatBlock label, Pill,
Segmented, SetPills, Stepper, `Typo variant="mono"`.

**Bundle** — `@expo/vector-icons/Ionicons` deep import in 20 files; 4 font weights by subpath
and `useFonts` from `expo-font`; ESLint `no-restricted-imports` forbids the barrels. Budgets in
`scripts/check-bundle-budget.mjs` tightened to HBC 3.28 MB, assets 930 KB / 31 files / 5 fonts.

**Re-renders** — all provider values `useMemo`'d; mutators wrapped by `hooks/useStableHandlers`
(latest-ref wrappers with permanent identity); stable empty defaults in useCompletion /
useSupplements / useLog / Meals / Timeline; `showToast` `useCallback`'d and ToastContext split
into dispatcher (`useToastContext`) and state (`useToastState`); `useAppState()` shim deleted
after moving `log.tsx` and `supplements.tsx` to domain hooks.

## Visual check

Expo web on :8381 against the local API (:3001 only allows the :8081 origin, so the
Playwright script relays API calls with that origin). Screens: `docs/log/screens/a11y/`
`{before,after}-{light,dark}-{login,focus,nutrition,program,settings}.png` (Pixel-7 size,
reduced motion). Nothing broken; visible shifts are the brighter dark accent, dark ink on the
blue toast, and deeper light-mode semantic colours. Pre-existing on web in both: the tab bar
labels are clipped at the bottom.

## Not done / handed off

- `expo-notifications` (+ the `assert` polyfill it pulls in) stays on the startup path because
  `hooks/useWorkout.ts` statically imports `utils/notifications` — both owned by mobile-logic.
  Lazy-loading it there (and in `NotificationResponder`) is the next step.
- Workout tick still re-renders every `useProgram()` consumer: needs a `WorkoutContext`
  (useWorkout owner). The redundant boot-time `PUT /preferences` lives in `useProgram`.
- No `React.memo` on Focus cards (Focus is being redesigned next).
- `ErrorBoundary` fallback and the pre-font spinner in `_layout.tsx` still use the
  module-load palette (render before/outside ThemeProvider).
- Axe-core Playwright scan (plan's third judge) not added.
- AGENTS.md still describes `useAppState()` and module-load-only theming; refresh with Bet 14.
