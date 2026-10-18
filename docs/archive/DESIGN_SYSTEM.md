> **Archived 2026-10-18 — STALE: its theming section predated the live theme switch; rules 1, 2 and 6 (Typo, Input, reduced motion) still worth doing; no-spread rule 3 was dropped.** (verdicts: `docs/audit/01-architecture-and-docs.md` §3; current truth: `AGENTS.md`)

# Onyx Design System

Living reference for tokens, primitives, and usage rules. The older design docs
(`DESIGN_LANGUAGE_REDESIGN.md`, `UI_EXCELLENCE_PLAN.md`, etc.) are historical
planning artifacts; this file is the current source of truth.

## Principles

- **One jewel accent.** Semantic colors (good/warning/danger/supplement) stay
  slightly muted so the accent always wins attention.
- **Tonal surfaces, not alpha films.** Dark scheme steps `bg → surface →
  surface2 → surfaceHover` as opaque tones.
- **Numerals are mono.** Every number (weights, macros, timers, streaks) uses
  JetBrains Mono with `tabular-nums`.
- **Tokens only.** No raw hex, no raw font sizes in screens/components. If a
  value isn't in `theme.ts`, add a named token first.

## Tokens (`mobile/theme.ts`)

| Group | Keys | Notes |
|---|---|---|
| Palette | `bg surface surface2 surfaceHover text muted faint border borderLight shadow accent accentDim accent2 good warning danger supplement edgeHighlight` | Dual light/dark; access via `useTheme().colors` |
| On-color inks | `onAccent onFill` | `onAccent` = ink on accent-filled controls (dark ink in dark scheme, white in light). `onFill` = white on saturated fills (danger, toast, checked box) |
| Time-of-day | `timeSun timeMoon` | Greeting glyphs; darkened in light scheme for contrast |
| Spacing | `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 28 · xxxl 40` | |
| Radii | `xs 8 · sm 12 · md 16 · lg 24 · full 999` | |
| Font sizes | `xs 11 · sm 12 · md 14 · lg 16 · xl 18 · xxl 24 · title 30 · hero 44` | |
| Fonts | `display displayBlack mono monoBold sans brand` | Archivo + JetBrains Mono |
| Icon sizes | `sm 14 · md 16 · lg 18 · xl 22` | |
| Tints | `useTheme().tints` — translucent washes per semantic color | For badges/chips backgrounds |

Scheme is resolved at app launch (`Appearance.getColorScheme()`); components
must take colors from `useTheme()` + `makeStyles(colors)` so a future live
switch stays possible. Do not import the static `colors` export in new code.

## Primitives (`mobile/components/ui/`)

| Component | Use for |
|---|---|
| `Typo` | All text. Variants: `title` `heading` `body` `meta` `label` (caps micro) `mono` (tabular numerals). `color`/`style` props to deviate |
| `Button` | Any tappable action. Variants `primary/secondary/ghost/danger`, sizes `sm/md/lg`, `icon`, `loading` |
| `Input` | Every text field. Built-in label, unit, icon, error, mono, secure entry |
| `Card` | Surface container, optional `title` |
| `Sheet` / `ConfirmModal` | Bottom sheet / destructive confirmation |
| `Stepper` | Numeric entry with +/- (weights, reps) |
| `Segmented` / `Pill` / `FAB` / `IconButton` | Controls |
| `Ring` / `ProgressBar` / `BarChart` / `StatBlock` / `AnimatedNumber` | Data display |
| `Toast` (via `useToast`) | Transient feedback |
| `EmptyState` / `SectionTitle` / `Glow` / `Burst` | Layout/atmosphere |

Shared (non-ui) building blocks: `shared/Checkbox`, `shared/ChecklistSection`,
`shared/SyncStatusPill` (offline queue indicator), `layout/ScreenContainer`,
`layout/Header`.

## Rules

1. **Text**: reach for `Typo` before `<Text>` + hand-rolled style. Custom
   styles only for one-off display treatments (hero numerals etc.).
2. **Forms**: `ui/Input` + `ui/Button`, never raw `TextInput`/`Pressable`
   buttons. See `components/supplements/SupplementForm.tsx` as the exemplar.
3. **Styles**: `const styles = useMemo(() => makeStyles(colors), [colors])`
   pattern; StyleSheet at file bottom. No spread/rest operators (lint enforces).
4. **Touch targets**: min 44pt height; use `hitSlopDefault` for icon-sized
   targets.
5. **Accessibility**: interactive elements get `accessibilityLabel`; charts
   provide screen-reader summaries; secondary text must clear ~4.5:1.
6. **Motion**: reanimated entrances (`FadeInDown`, `ZoomIn`) sparingly —
   entrance stagger on lists, scale-in on modals. (TODO: respect reduced
   motion.)
7. **New color/size**: add a named token to `theme.ts` first, then use it.
   Never inline hex or numbers.
