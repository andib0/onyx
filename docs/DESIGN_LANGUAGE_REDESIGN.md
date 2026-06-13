# Onyx — Design Language Redesign

A step-change, not another pass. After many incremental UI edits the app is
**competent but anonymous** — it reads as "a dark fitness app," interchangeable
with fifty others. This plan gives Onyx a single, opinionated identity and
rebuilds the component system against it.

---

## 0. The honest diagnosis

What's good (keep): 3-level surfaces, mono numerals, SVG rings/charts, blur tab
bar, contextual Focus, grouped settings rows.

What's holding it back:
1. **No identity.** Generic blue accent (`#7aa2ff`), default system + Menlo fonts,
   Ionicons at default weight. Nothing memorable. The name "Onyx" promises a
   jewel; the UI delivers a template.
2. **Inconsistent inputs.** Forms use `sharedStyles.formInput`, Stepper uses its
   own, check-in uses another, settings edit another. Four input treatments.
3. **Flat hierarchy persists.** Cards are mostly one weight; the eye isn't led.
4. **Type is undifferentiated.** Size/weight vary but there's no *voice* — no
   display face, no editorial contrast between label and number.
5. **Motion is sprinkled, not systemic.** Some count-ups, some springs, no rule.
6. **Icons carry no brand.** No app mark, no illustration language.

The fix is not more components — it's **fewer, stronger, unified** ones under a
named direction.

---

## 1. Design direction: "Instrument"

Onyx as a **precision instrument for the body** — think high-end performance
dashboard × Swiss-watch complication × the restraint of Teenage Engineering. Data
is treated like jewelry on near-black. Principles:

- **Near-black, not flat-black.** Deep desaturated base with subtle blue-cool
  undertone; surfaces are *tonal steps*, not alpha films.
- **Numbers are the hero.** Every screen has one number that dominates; everything
  else recedes to labels.
- **One jewel accent.** A single saturated accent does all the work; semantic
  colors (good/warn/danger) stay muted so the accent always wins attention
  (Von Restorff by construction).
- **Editorial type contrast.** A characterful display face for headings/numbers
  against a clean body face. High contrast in weight and size, generous tracking
  on micro-labels.
- **Quiet motion, loud moments.** Default interactions are calm (subtle spring);
  reward moments (PR, perfect day, achievement) are the only place motion gets
  expressive.

---

## 2. Token system overhaul

### 2.1 Color
- **Base ramp** (tonal, not alpha): `bg #0a0d11` → `surface #12161c` →
  `surface2 #1a1f27` → `surface3 #232a34`. Each a real step; borders become
  hairlines `rgba(255,255,255,.08)` + top-edge highlight for "lit" cards.
- **Accent**: pick ONE jewel (decision below). Provide `accent`, `accentDim`
  (~40%), `accentGlow` (~12%) for fills/glows.
- **Semantics muted**: `good`, `warn`, `danger` desaturated ~15% so the accent
  dominates. Success states use accent + a small check, not loud green, except the
  one celebratory surface.
- **Text**: `text .94`, `muted .60`, `faint .40` — re-tuned for AA at body size.

### 2.2 Type scale (with a real display face)
- **Display face**: a distinctive grotesk/expanded face for screen titles + hero
  numbers (loaded via `expo-font` / `@expo-google-fonts`). Candidates: Clash
  Display, Space Grotesk (overused — avoid), Archivo Expanded, or a mono-display
  like Martian Mono for full instrument feel.
- **Numerals**: a refined monospace (e.g. Geist Mono / Martian Mono) replacing the
  default Menlo — tabular, tighter, more characterful.
- **Body**: keep system (fast, native, legible) OR a clean grotesk (Inter is
  banned by our own taste — consider Geist/Hanken Grotesk).
- Ramp: display 40/30 · number hero 56–72 · stat 24 · title 17/600 · body 15/1.5 ·
  caption 13 · micro-label 11 uppercase +1.4 tracking.

### 2.3 Radii / elevation / spacing
- Radii: `xs 8 · sm 12 · md 16 · lg 24 · pill 999` (slightly rounder = friendlier
  premium).
- Elevation: 2 shadow tokens (`raised`, `floating`) used sparingly — most depth
  comes from surface tone + top highlight, not heavy shadows.
- Spacing: keep 4/8/12/16/20/28/40; document and stop using raw numbers.

---

## 3. Component system — unify and elevate

Build/curate a small canonical set; migrate every screen onto it. No more
bespoke inputs/buttons.

| Component | Action |
|---|---|
| **Input** (new, canonical) | One text input: label, value, unit suffix, error, keyboard type. Replaces formInput, check-in fields, settings edit, quick-add, supplement form. |
| **Stepper** | Re-skin on Input tokens; keep −/+. |
| **Button** | Keep variants; restyle to new tokens; add `loading` state + leading icon slot. |
| **Card** | 3 explicit variants: `flat` (default), `raised` (hero), `inset` (sub-panel). |
| **StatBlock** (new) | Big number + label, the instrument unit; used in exercise detail, recaps, finished screen, day score. |
| **Ring** | Re-skin: thinner stroke, gradient, optional center StatBlock; animated. |
| **Chart** | Unify BarChart + area into one `Chart` with `type` + interaction (tap point → value tooltip), range toggle. |
| **ListRow / SettingsRow** | Already good; promote to the one row primitive for every list (schedule, checklist, settings, nutrition). |
| **Chip / Segmented** | Re-skin on tokens; one chip style everywhere. |
| **Sheet** (new) | Bottom sheet for add/edit flows (replaces inline-expand panels) — modern, focused, dismissible. |
| **EmptyState** | Add an illustration set (simple line/duotone SVGs) instead of single icon. |
| **Toast** | Re-skin; support an icon + optional action ("Undo"). |

---

## 4. Identity / brand

- **App mark**: a simple geometric "O"/onyx-facet glyph (SVG) — used on auth,
  onboarding, splash, empty states. First real brand asset.
- **Illustration language**: 3–5 minimal duotone SVG spots for empty states
  (no meals, no program, no history) — consistent stroke + the accent.
- **Iconography**: standardize on Ionicons at one size/weight; reserve filled for
  active/selected only.
- **Splash + app icon**: align to the near-black + jewel accent.

---

## 5. Motion language (codify in one file)

- **Standard**: 180ms ease-out for state, spring (damping 18, stiffness 320) for
  press.
- **Entrance**: staggered `FadeInDown` 60ms step, capped at 6 items.
- **Numbers**: count-up 500ms ease-out on change (AnimatedNumber everywhere a
  number updates).
- **Reward** (rare): burst, ring glow-pulse, scale-in badge.
- All gated on reduce-motion. Document do/don't.

---

## 6. Screen re-skins (after tokens + components land)

Mechanical once the system is rebuilt — each screen swaps to new tokens/components:
- **Focus**: hero day-score ring as a true centerpiece (bigger, gradient, glow,
  count-up); everything else quiet.
- **Workout**: rest screen already strong — re-skin to tokens; set pills on new chip.
- **Program / Exercise detail**: StatBlocks + unified Chart with range toggle.
- **Nutrition**: macro dashboard on new Ring/Chart; add Sheet for add flow.
- **Settings**: already grouped — re-skin only.

---

## 7. Execution order

1. **Tokens** — colors, type (load fonts), radii, elevation, motion constants.
2. **Core components** — Input, Card variants, StatBlock, Button/Chip/Segmented
   re-skin, Ring/Chart unify, Sheet.
3. **Brand** — app mark, empty-state illustrations.
4. **Screen re-skins** — Focus → Workout → Program/Exercise → Nutrition → Settings.
5. **Motion pass** — apply the codified language; reduce-motion audit.
6. **A11y pass** — contrast at new tokens, Dynamic Type, labels.

Ship per-phase; each is independently valuable and reversible.

---

## 8. Decisions needed before executing (taste calls)

These materially change every screen; lock them first:
- **Accent jewel** — the single signature color.
- **Display typeface** — the voice.
- **Theme** — commit dark-only, or build light too now.
- **Add flows** — bottom Sheets vs current inline expanders.

Guardrail: this is a re-skin + unify on the existing IA and logic — no feature
regressions. Every phase keeps typecheck/lint green and the app shippable.
