# Onyx — UI/UX Overhaul TODO (detailed)

Living checklist for a unified, modern, sleek, performant mobile UI.
Grounded in the shipped design system (jewel-blue / Archivo + JetBrains Mono / tonal dark+light)
and the UI/UX Pro Max rule framework (a11y → touch → perf → style → layout → type/color → animation → forms → nav → charts).

**Legend:** `[x]` done · `[~]` partial · `[ ]` todo
**Platform:** Expo / React Native + Expo Router. App UI rules (Apple HIG / Material), not web.

---

## 0. How to use

1. Do **§1 Design tokens** first — everything downstream references them.
2. Then the **cross-cutting passes** (§2 motion, §3 a11y, §4 perf, §5 copy) — they touch many files once.
3. Then walk **§6 components** and **§7 screens** with the per-item checklists.
4. **§8 settings** and **§9 copy table** are leaf-level detail.
5. Verify against **§10 pre-ship checklist** before calling done.

---

## 1. Design tokens — single source of truth (`mobile/theme.ts`)

Foundation shipped; remaining = centralize the values still living as inline literals.

- [x] Color palettes dark + light (`darkColors`/`lightColors`, `getPalette`)
- [x] Tints per scheme (`getTints`)
- [x] Live theming via `useTheme()` + `makeStyles(colors[,tints])` + `useMemo`
- [x] Radii scale (`xs8/sm12/md16/lg24/full`)
- [x] Fonts (Archivo display, JetBrains mono, system sans)
- [x] Spacing scale (4/8 rhythm)
- [ ] **Add `motion` tokens** — durations + easings are scattered as literals (220/240/600ms, `Easing.out(Easing.cubic)`, spring damping/stiffness). Centralize:
  - `motion.fast = 150`, `motion.base = 220`, `motion.slow = 320`, `motion.exit = base*0.65`
  - `motion.spring = { damping: 18, stiffness: 220 }`, `motion.springTight = { damping: 12, stiffness: 320 }`
  - `motion.easeOut`, `motion.easeIn` presets
- [ ] **Add `elevation` tokens** — shadow values are per-component literals (FAB, Toast, Card edge). Define `elevation.sm/md/lg` (shadowColor/opacity/radius/offset + elevation) so cards/sheets/FAB/toast share one ramp.
- [ ] **Add `zIndex` scale** — Toast uses `1000`, sheets use Modal; define `z.base/nav/overlay/toast` to avoid magic numbers.
- [ ] **Add `hitSlop` default token** (e.g. `6`) used by all icon-sized Pressables.
- [ ] `iconSizes` token (`sm14/md16/lg18/xl22`) — icon sizes are ad-hoc (13/14/15/16/18/22/26). Pick a scale.
- [x] `TAG_COLORS` (decorative, static — fine on both schemes)

---

## 2. Motion system pass (animation)

Rules: 150–300ms micro, transform/opacity only, ease-out enter / ease-in exit, exit faster than enter, respect reduced-motion, interruptible, stagger 30–50ms.

- [~] **Reduced-motion coverage** — gated in Ring, Sheet, Checkbox, Segmented, Burst, LoadingScreen. Audit the rest:
  - [ ] Focus screen `FadeInDown` entrances (greeting, day-score) — confirm they no-op under `useReducedMotion`
  - [ ] FAB `ZoomIn` entrance — add reduced-motion fallback (currently always animates)
  - [ ] Any `entering=` on cards across screens
- [ ] **Migrate all inline durations/easings → `motion` tokens** (§1) so the whole app shares one rhythm.
- [ ] **Stagger list entrances** — Focus cards / nutrition meals / schedule blocks: 30–50ms per item on first mount (skip under reduced-motion). Currently mixed/none.
- [ ] **Exit < enter** — audit Sheet/Toast/Modal: exits should be ~65% of enter duration.
- [x] Press physics on Button (spring scale), IconButton (scale 0.92), Stepper keys, FAB
- [ ] **`scale-feedback` on tappable cards** — MealCard, ProgramCard, BlockItem lift bg but don't scale; add subtle 0.97 press scale where it's a primary tap target.
- [ ] **Animated number rollups** — `AnimatedNumber` exists; apply to Day Score %, macro totals, streak count for premium feel (currently static text in places).
- [ ] **Shared-element / continuity** — exercise tap-through (program → exercise detail) is a hard nav; consider a directional slide for spatial continuity (low priority).

---

## 3. Accessibility pass (CRITICAL)

- [~] **`accessibilityLabel` on icon-only controls** — IconButton ✓. Audit raw `Pressable`s: program overflow menu, nutrition chips, segment options (Segmented has role+state ✓), MealCard quick-chips.
- [ ] **`accessibilityRole`** on all custom buttons/links (many `Pressable` lack `role="button"`).
- [ ] **Chart a11y** — Ring has `progressbar` ✓. BarChart + WeightTrend + MacroDashboard: add `accessibilityLabel` summarizing the key value/trend (screen-reader can't read SVG).
- [ ] **Contrast audit both schemes** — light `muted/faint` bumped ✓; verify: `faint` placeholders, tint-on-tint chips, `accentDim` borders, disabled 0.4 opacity all ≥3:1 (UI) / 4.5:1 (text). Test dark independently.
- [ ] **Dynamic Type** — only StatBlock sets `maxFontSizeMultiplier`. Audit truncation at largest text size on: tab labels, Header title, MealCard, BlockItem, Row label/value, StatBlock labels. Prefer wrap over clip.
- [ ] **Reduced-motion** (see §2).
- [ ] **Focus order / VoiceOver** — logical reading order on Focus (greeting → score → hero → lists), Settings groups.
- [ ] **`color-not-only`** — supplement teal, tag colors, over-target warning: ensure paired with icon/text, not color alone.
- [ ] **Forms** — error text near field + `role="alert"` / `aria-live` equivalent; auto-focus first invalid (BlockForm, program-editor, auth, supplement form).

---

## 4. Performance pass (HIGH)

- [ ] **Virtualize long lists** — screens render via `.map()` inside `ScrollView`. Convert to `FlatList`/`FlashList` where lists can grow:
  - [ ] `log.tsx` history entries (can be long)
  - [ ] `exercise/[name].tsx` session history
  - [ ] FoodSearchSection / MyFoodsSection results
  - [ ] schedule blocks, nutrition meals (usually small — only if they grow)
- [ ] **`useMemo` audit** — `makeStyles` memoized ✓. Check derived lists (sorted achievements, insights, proteinBars) aren't recomputed every render.
- [ ] **Image/asset** — minimal images; verify any (logo, icons) are vector. ✓ icons are vector.
- [ ] **Debounce** — food search already debounced ✓. Audit other text-driven queries.
- [ ] **`main-thread` / reanimated** — animations are on UI thread via reanimated ✓. Keep SVG charts cheap (avoid re-render on every tick).
- [ ] **Skeletons over spinners** — `LoadingScreen` shimmer ✓; ensure per-screen loading uses it, not bare `ActivityIndicator` (supplements/auth still use ActivityIndicator).

---

## 5. Copy / text voice pass

Define one voice: **terse, second-person, sentence case for sentences, UPPERCASE micro-labels for eyebrows.**

- [ ] **Eyebrow labels** consistent: `SectionTitle` uppercase + accent tick ✓ — make every section header use it (some screens hand-roll labels).
- [ ] **Numbers** always mono + tabular (prices, reps, timers, macros, %). Audit stray system-font numerals.
- [ ] **Toasts** — concise, type-aware ✓. Ensure all read as `"<Did the thing>"` (success) or `"Couldn't <x> — try again"` (error). See §9.
- [ ] **Empty states** — every list has an `EmptyState` (icon + title + subtitle + optional action). Audit each screen (§7).
- [ ] **Buttons** — verb-first ("Add task", "Start workout", "Save"). Audit.
- [ ] **Dates/units** — locale-aware, consistent (`kg`, `g`, `kcal`, `7 days`, `08:00`).

---

## 6. Component-by-component (43)

### UI primitives (`components/ui/`)
- [x] **Button** — variants, spring press, leading icon. [ ] add `loading` state (spinner + disabled) for async CTAs.
- [x] **Card** — header icon + right slot, edge highlight. [ ] optional `onPress` variant with press scale for tappable cards.
- [x] **Input** — focus border + tint + icon. [ ] error state (danger border + helper text), `password` toggle, semantic `textContentType`/`autoComplete`.
- [x] **Sheet** — slide-up, grabber, header divider, keyboard-aware. [ ] swipe-down-to-dismiss; [ ] confirm-on-dismiss when form dirty.
- [x] **StatBlock** — mono number + label, `maxFontSizeMultiplier`.
- [x] **Ring** — gradient, animated, progressbar role.
- [x] **BarChart** — current-bar value label, gradient. [ ] a11y summary; [ ] empty-data state.
- [x] **ProgressBar** — rounded caps, optional label/percent.
- [x] **SettingsGroup / Row / GroupTitle** — tonal icon chips, pressed bg, chevron.
- [x] **Segmented** — sliding accent thumb, haptic.
- [x] **IconButton** — pressed circle + scale, hitSlop.
- [x] **FAB** — accent glow, zoom entrance. [ ] reduced-motion fallback.
- [x] **EmptyState** — accent halo icon + action.
- [x] **Toast** — type-aware icon/color, slide-up, shadow. [ ] `aria-live`/announce for screen readers; [ ] undo action slot for destructive.
- [x] **Stepper** — tactile keys. [ ] focus-highlight on the text field (Input got it; Stepper field didn't).
- [x] **ConfirmModal** — destructive styling. [ ] migrate to `Sheet` for visual consistency (currently bespoke Modal); [ ] scale-from-trigger motion.
- [x] **Pill** — color dot.
- [x] **SectionTitle** — accent tick.
- [x] **Glow** — tight-core falloff fix. [ ] expose `intensity` presets; verify on light scheme.
- [x] **Burst** — particle celebration (static colors, fine).
- [~] **AnimatedNumber** — exists; [ ] actually wire into Day Score / macros / streak (§2).

### Shared (`components/shared/`)
- [x] **Checkbox** — spring pop. [ ] add haptic on toggle (standalone usage); confirm color-not-only (shape changes ✓).
- [x] **ChipSelector** — tinted active. [ ] press scale; a11y selected state.
- [x] **ChecklistSection** — chevron "+N more", shared Checkbox.
- [x] **LoadingScreen** — shimmer skeleton.
- [~] **ErrorBoundary** — class component, static colors (intentional). [ ] restyle fallback to match design (icon + EmptyState look) even on static palette.
- [x] **NotificationResponder** — logic only, no UI.

### Layout (`components/layout/`)
- [x] **Header** — display font, subtitle. [ ] optional right-accessory slot used consistently.
- [x] **ScreenContainer** — safe-area, pull-to-refresh, FAB slot. [ ] standardize bottom inset token (FAB `bottom:100` + content `paddingBottom:120` are separate magic numbers — derive from tab-bar height).

### Focus (`components/focus/`)
- [x] DayCheckInCard · GettingStartedCard · RecapCard · WeeklyRecapCard · InsightsTeaserCard · TimelineSummary · FocusBlockPanel — all themed + StatBlock/Input.
- [~] **WorkoutSection** — themed; rest ring + finished StatBlocks ✓. [ ] set-pill stagger; [ ] rest timer reduced-motion; [ ] big rest number → AnimatedNumber.

### Nutrition (`components/nutrition/`)
- [x] **MealCard** — macro-pill tonal chips, grams chips.
- [x] **MacroDashboard** — rings/bars, over-target warning. [ ] a11y summary per macro.
- [~] **FoodSearchSection / MyFoodsSection** — functional; [ ] virtualize results, [ ] skeleton while searching, [ ] empty/no-results state.

### Schedule (`components/schedule/`)
- [x] **BlockItem** — press lift, tag accent, shared Checkbox.
- [x] **BlockForm** — embedded-in-sheet mode, canonical fields. [ ] inline validation + first-invalid focus.

### Log
- [x] **WeightTrend** — SVG area chart, rate color. [ ] a11y summary; [ ] empty state when <2 points (currently returns null — show a hint instead).

---

## 7. Screen-by-screen (19)

Each screen checklist: **layout/hierarchy · single primary CTA · empty · loading · error · entrance motion · copy · safe-area**.

- [~] **Focus** (`(tabs)/focus.tsx`) — hero hierarchy ✓, contextual slot ✓, insights teaser ✓. [ ] entrance stagger, [ ] AnimatedNumber on score, [ ] reduced-motion audit.
- [~] **Nutrition** (`(tabs)/nutrition.tsx`) — macro dashboard, protein trend w/ label + adaptive suggestion ✓. [ ] virtualize meals/foods, [ ] search skeleton, [ ] empty meals state copy.
- [~] **Program** (`(tabs)/program.tsx`) — picker sheet, segmented days, progression chips ✓. [ ] empty (no program) state polish, [ ] exercise tap-through continuity.
- [~] **Schedule** (`(tabs)/schedule.tsx`) — progress card, blocks, FAB, sheet add/edit ✓. [ ] empty state ✓ exists — verify copy; [ ] entrance stagger.
- [~] **Settings** (`(tabs)/settings.tsx`) — grouped rows, appearance toggle ✓. See §8 detail.
- [~] **Exercise detail** (`exercise/[name].tsx`) — StatBlock headline + charts ✓. [ ] virtualize history, [ ] a11y chart summary, [ ] empty (no history) state.
- [~] **Insights** (`insights.tsx`) — median-split cards. [ ] locked/empty state (<14 days) polish to match teaser, [ ] card entrance stagger.
- [~] **Achievements** (`achievements.tsx`) — Next-badge goal-gradient + earned/in-progress ✓. [ ] unlock celebration on first view, [ ] progress ring on next-badge instead of bar (optional).
- [~] **Log / History** (`log.tsx`) — weight trend + entries. [ ] virtualize entries, [ ] empty state, [ ] `ActivityIndicator` → skeleton.
- [~] **Supplements** (`supplements.tsx`) — unified card (Checkbox + IconButtons) ✓. [ ] `ActivityIndicator` → skeleton, [ ] search results virtualization, [ ] form inline validation.
- [~] **Program editor** (`program-editor.tsx`) — exercise autocomplete, smallInput cells. [ ] inline validation + first-invalid focus, [ ] reorder affordance polish, [ ] unsaved-changes confirm on dismiss.
- [~] **Onboarding** (`onboarding.tsx`) — 3 steps + seed. [ ] step progress indicator, [ ] entrance motion, [ ] copy pass.
- [~] **Auth — login / register** (`(auth)/*`) — pre-redesign era. [ ] migrate inputs to canonical `Input`, [ ] error states, [ ] `ActivityIndicator` → button loading, [ ] keyboard types + autofill, [ ] brand/hero polish.
- [ ] **+not-found** — restyle to EmptyState look with a "Back to Focus" action.
- [x] **index / `_layout` / `(auth)/_layout`** — routing + theme chrome (StatusBar, headers, tab bar) ✓.

---

## 8. Settings — per section / row / text

- [x] **Profile** — inline edit (name/weight/...) via Input.
- [x] **Progress** — adherence chart + Insights/Achievements/History links.
- [x] **Notifications** — supplement / check-in / rest toggles.
- [x] **Appearance** — System/Light/Dark Segmented, live. [ ] add tiny preview swatch row (optional flourish).
- [x] **Data** — export / import backup.
- [x] **Account** — sign out (destructive, separated). [ ] confirm dialog ✓ verify copy.
- [x] **About** — version line.
- [ ] **Row consistency** — every row has icon chip ✓; verify `value`/`sublabel`/chevron usage is consistent; destructive rows use danger chip ✓.
- [ ] **Copy** — group titles UPPERCASE; row labels sentence case; sublabels terse.

---

## 9. Copy / microcopy table (audit + unify)

- [ ] **Toasts** success: `"Added <x>"`, `"Saved"`, `"<X> updated"`, `"Day logged"`, `"Copied"`. error: `"Couldn't <verb> — try again"`. (Auto-classified by Toast ✓ — keep copy matching the classifier keywords.)
- [ ] **Empty states** — pattern: title = what's missing, subtitle = how to fix, action = the fix. One per list.
- [ ] **Buttons / CTAs** — verb-first, ≤2 words where possible.
- [ ] **Section eyebrows** — noun, UPPERCASE (`PROTEIN · 7 DAYS`, `IN PROGRESS`, `EARNED`).
- [ ] **Errors** — state cause + fix, never bare `"Invalid"`.
- [ ] **Validation** — `"<Field> needs a name"`, `"Add at least one exercise"` (already good — keep).

---

## 10. Pre-ship checklist (run before "done")

- [ ] `cd mobile && npx tsc --noEmit && npx eslint .` clean
- [ ] Light **and** dark both eyeballed on a real device (not inferred)
- [ ] Reduced-motion ON — nothing breaks, animations no-op
- [ ] Dynamic Type at largest — no clipping, layouts hold
- [ ] All touch targets ≥44pt; no content under notch / home indicator
- [ ] Every list: loading (skeleton) + empty + error states exist
- [ ] One primary CTA per screen; destructive actions separated + confirmed
- [ ] Numbers mono+tabular; icons one family/weight; no emoji as icons
- [ ] 375px width + landscape sanity pass

---

## Suggested execution order

1. **§1 tokens** (motion/elevation/z/hitSlop/icon) — unlocks consistency everywhere.
2. **§2 motion pass** — migrate to tokens + stagger + reduced-motion audit.
3. **§3 a11y pass** + **§4 perf pass** (virtualize lists) — systemic, high impact.
4. **§7 auth + not-found + onboarding** — the last un-redesigned screens.
5. **§6 component leftovers** (Button loading, Input error, ConfirmModal→Sheet, AnimatedNumber wiring).
6. **§5 / §9 copy pass** — final polish.
7. **§10 pre-ship**.

> Status today: design-system foundation, live theming, and component polish are **shipped**. This list is the *remaining* fine-grain unification + the systemic passes (motion tokens, a11y, perf, copy) + the screens that predate the redesign (auth, not-found, onboarding).
