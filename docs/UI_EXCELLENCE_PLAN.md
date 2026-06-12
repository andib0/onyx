# Onyx — UI Excellence Plan

Goal: move from "clean functional dark app" to an interface that feels crafted — the Apple Fitness / Whoop tier. Functional architecture stays; this is the visual + motion + feel layer. Every item is implementable in Expo (Expo Go compatible unless flagged).

---

## 0. The diagnosis

Onyx today is structurally good but visually flat:

1. **One surface level.** Every card is the same `rgba(255,255,255,0.04)` + 1px border. No depth, no atmosphere, no focal lighting. Whoop and Apple Fitness feel "deep" because they layer: background glow → surface → elevated surface → accent glow.
2. **Numbers don't feel like the product.** We use mono numerals (good instinct) but at body sizes. In Apple Fitness, the number IS the screen — 96pt+, tight tracking, color-graded.
3. **No motion vocabulary.** We have two entrance animations and a ring fill. Best-in-class apps choreograph: staggered card entrances, springy presses, number count-ups, progress that animates on every change — not just mount.
4. **Color is semantic but not atmospheric.** Flat hex on flat black. The leaders use gradients *inside* data (ring strokes, chart fills) and ambient tinted glows behind hero elements.
5. **Charts are bars made of Views.** Real apps: smooth area charts with gradient fills, dot markers, tooltips.

---

## 1. Visual language upgrade (the foundation)

### 1.1 Surface system — 3 elevation levels
Borrow: **Whoop's layered black**.
- `bg` `#0b0f14` (keep)
- `surface1` — cards: slightly *bluer* dark `#11161d` solid (replace alpha-white; alpha surfaces gray out on dark and kill contrast)
- `surface2` — elevated elements inside cards (exercise box, inputs): `#161c24`
- Hero surfaces get a **1px top-edge highlight** (`rgba(255,255,255,0.06)` top border only) — fakes lighting, signature dark-UI trick.

### 1.2 Ambient glow
Borrow: **Apple Fitness ring glow / Oura gradients**.
- Radial gradient blob behind hero elements: accent at 8% opacity, 300px radius, positioned behind the Day-Score ring and rest timer. `expo-linear-gradient` (radial faked with stacked linear or an SVG radialGradient — we have react-native-svg).
- Greeting header: subtle time-of-day gradient wash across the top 200px — dawn peach, day blue, evening violet, night deep indigo (ties into the existing sun/moon icon).

### 1.3 Gradient data
- Ring stroke → SVG linearGradient (accent → accent2). Done once in `Ring`, every ring in the app upgrades.
- Progress bars → 2-stop gradient fill.
- Weight chart → area fill with vertical gradient (accent 35% → transparent).

### 1.4 Typography ramp with a display face
Borrow: **MacroFactor's confident numerals**.
- Numerals: keep mono but introduce a **display tier**: 64–96pt for the one number a screen is about (rest timer already 72 — extend to Day Score % on a future detail view, kcal in dashboard ring at larger size).
- Add `fontVariant: ["tabular-nums"]` everywhere numbers update live (no jitter).
- Letter-spacing discipline: big numerals −1; labels +1.2 uppercase 11pt. Already close; codify in theme as `typeRamp` presets so screens stop hand-rolling.

---

## 2. Motion choreography

Reanimated is installed; we're using 5% of it.

### 2.1 Screen entrance
- Stagger: cards enter with `FadeInDown.delay(i * 60).springify()` — first paint feels orchestrated. Wrap in `AnimatedCard` so it's one component change.
- Tab switch: subtle 8px slide — comes free with `expo-router` transitions config.

### 2.2 Number count-up
Borrow: **Whoop strain reveal**.
- `AnimatedNumber` component (reanimated shared value → derived text): kcal, Day Score %, weight delta count up over 500ms on mount/change. Single highest-impact micro-interaction for a data app.

### 2.3 Progress reacts to *change*, not just mount
- Ring + bars animate on every value change (already true for Ring via `withTiming` — verify bars; MacroDashboard bar widths are static styles → animate width with reanimated).

### 2.4 Press physics
- Button/Card presses: scale 0.97 with `withSpring` (stiff, damped) instead of opacity-only. One change in `Button`/pressable styles.

### 2.5 Celebration moments
Borrow: **Duolingo restraint applied to gym context**.
- Workout complete with PRs → particle burst (20 SVG circles, reanimated springs, 800ms, then gone). No Lottie dependency needed.
- Perfect day → ring does one slow glow pulse (shadow radius animation).
- Keep to exactly these two; celebrations devalue fast.

### 2.6 Skeletons
- Replace `LoadingScreen` spinner with shimmer skeleton (3 gray cards, animated opacity loop). Perceived performance jump.

---

## 3. Screen-specific "wow" passes

### 3.1 Focus — the daily cockpit
Borrow: **Apple Fitness "Summary" + Gentler Streak warmth**.
- Time-of-day gradient header (1.2).
- Day Score becomes the visual centerpiece: bigger ring (88px), gradient stroke, glow, count-up %, streak flame chip attached to ring edge.
- Cards stagger in (2.1).

### 3.2 Workout — the strongest candidate for "insane"
Borrow: **Hevy/Strong set tables + Whoop timer screens**.
- **Rest screen goes full-bleed:** background glow in `good`, 96pt timer, thin progress arc *around* the timer (reuse Ring), next-exercise card slides up from bottom. This is the screen users stare at 20×/session — make it the best screen in the app.
- Lifting card: set dots → **set pills** with logged weight×reps inside (`80×8` `80×8` `· ·`) — history-at-a-glance like Hevy's table, but compact.
- PR moment: badge scales in with spring + one particle burst.

### 3.3 Nutrition
Borrow: **MacroFactor dashboard**.
- MacroDashboard: kcal ring gradient + count-up; macro bars animate; over-target turns segment amber with a small ▲.
- Water row: fill-glass micro animation on tap (droplet icon scales, value counts up).

### 3.4 Weight chart (Settings/Progress)
Borrow: **Oura trends**.
- Replace View-bars with SVG **smooth area chart**: cubic path through points, gradient fill, last-point dot with halo, dashed goal-pace line. We already have the data + react-native-svg. Biggest single visual upgrade per line of code.

### 3.5 Tab bar
Borrow: **iOS native polish**.
- `expo-blur` BlurView background (dark tint) instead of solid — content scrolls *under* it.
- Active tab: icon + 4px dot indicator, spring scale on switch.

---

## 4. Haptic vocabulary (feel layer)

Codify in `utils/haptics.ts` — today calls are scattered and inconsistent:
- `tap` (selection) — checks, chips, steppers
- `confirm` (light impact) — buttons, set done
- `success` (notification success) — workout done, PR, perfect day
- `warn` (notification warning) — over cutoff, over kcal target
Never more than one per gesture.

---

## 5. Copy voice (micro-UX)

Borrow: **Gentler Streak's empathy without the softness overdose**.
- Replace remaining system-ish strings: "Failed to update supplement" → "Couldn't save that — try again". One sweep file by file.
- Time-aware encouragement line under greeting (one line max, rotates): morning "Strong start wins the day", evening "Close it out".

---

## 6. Execution order

| Phase | Items | Effort | Visual delta |
|---|---|---|---|
| **P1 Foundation** | 1.1 surfaces, 1.4 type ramp, 2.4 press physics, 4 haptics util | 1 session | medium, app-wide |
| **P2 Signature** | 1.2 glow, 1.3 gradient ring/bars, 2.2 AnimatedNumber, 3.1 Focus pass | 1 session | huge |
| **P3 Workout wow** | 3.2 full-bleed rest screen, set pills, PR burst | 1 session | huge for core loop |
| **P4 Data beauty** | 3.4 area chart, 3.3 nutrition polish, 2.6 skeletons | 1 session | high |
| **P5 Chrome** | 3.5 blur tab bar, 2.1 staggers, 5 copy sweep | 0.5 session | polish |

Dependencies to add: `expo-linear-gradient`, `expo-blur` (both in Expo Go). Everything else uses installed packages (reanimated, svg).

Guardrails: every animation ≤600ms, all gated on reduce-motion, no animation on list scroll paths, FPS check on device after each phase.
