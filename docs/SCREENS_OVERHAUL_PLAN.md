# Nutrition / Program / Settings Overhaul + Charts

Audit of the three remaining inconsistent screens, plus a charts upgrade. Root
problem across all three: **ad-hoc buttons and cards instead of a shared row
primitive** — so sizes, separators, fonts and switches drift. Fix the primitive
once, apply everywhere.

---

## 0. Shared primitives (the consistency fix)

### 0.1 `SettingsGroup` + `Row` (new)
iOS grouped-list pattern. One `Card`, rows divided by hairlines. Every row is the
same height (52) and typography. Row variants by `right` accessory:
- `value` — right-aligned muted text (e.g. "75 kg")
- `switch` — `Switch` control
- `chevron` — navigates
- `custom` — arbitrary node
Props: `icon?`, `label`, `sublabel?`, `right`, `onPress?`, `destructive?`.
This single component replaces: settings notif rows, data buttons, account meta
rows, edit-profile button, sign-out, "open full log", about. Result: uniform
spacing/fonts/switch alignment automatically.

### 0.2 `Segmented` (new)
Equal-width segmented control for ≤5 options. Replaces program day `dayBtn`
cluster. (Nutrition weekday stays horizontal `ChipSelector` — 7 items scroll.)

### 0.3 `BarChart` (new, svg)
Generic vertical bars: values + labels, gradient fill, optional target line,
highlighted last bar. Reused for weekly adherence and (later) session volume.

---

## 1. Settings — grouped, unified

Current: 6 mismatched blocks (SectionTitle + Card each), buttons in 3 sizes,
switches in custom rows, account meta in another format, about as bare text.

New: a single scroll of **labelled groups**, each a `SettingsGroup` titled by a
small uppercase header (one consistent style), rows via `Row`:

- **PROFILE** — avatar header row; then rows: Name (value+edit), Weight (value+edit),
  Caffeine cutoff (value+edit). Inline edit becomes a row-level expand, not a
  separate bordered box. One edit affordance, not a mismatched button.
- **PROGRESS** — weight area chart (kept) + "Adherence this week" **BarChart**
  (new) + Row "Full history ›".
- **NOTIFICATIONS** — 3 switch rows (already close; routed through `Row`).
- **DATA** — Row "Export ›", Row "Import ›" (consistent rows, not side-by-side buttons).
- **ACCOUNT** — Row "Sign out" (destructive), About line as a final centered caption.

Outcome: identical row heights, one switch style, one label font, hairline
separators, section headers all uppercase 11pt. No size drift possible.

---

## 2. Nutrition — kill duplicates, tighten

Duplicates/clutter found:
- **Add-food appears 3×**: EmptyState "+ Add food", the big "+ Add food" button,
  and quick-add. → Collapse to **one** "Add food or meal" entry that expands the
  search + quick-add together. EmptyState reuses the same handler.
- **"Manage supplements"** button + full supplements checklist + count: supplements
  are a secondary concern on Nutrition. → Collapse to a **single Row**
  "Supplements · 2/5 taken ›" that opens the manage screen. Daily checking lives on
  Focus (already). Removes a whole checklist + button from this screen.
- **"Targets" card** duplicates the MacroDashboard (which already shows
  consumed/target per macro). → Remove the Targets card; surface hydration/goal as
  small captions under the dashboard if needed.
- **"Copy this day"** ghost button — keep but move into an overflow / keep as single
  ghost link under meals (fine).

New order: Header → weekday ChipSelector → **MacroDashboard** (the chart) → Meals
card → "Add food or meal" (one expander) → Supplements Row → done. ~3 fewer
controls, no dupes.

---

## 3. Program — unify controls, clearer hierarchy

Issues: management row mixes New/Edit/Delete/Customize as differently-coloured
small buttons; day picker is bespoke `dayBtn`; session header has its own Copy
button.

New:
- Selected program collapses to a header row with a single **overflow** ("⋯") →
  action sheet (Change, Edit/Customize, Delete). Removes the 2–3 button cluster.
- Day picker → `Segmented`.
- Session card: title row keeps one ghost "Copy" (consistent sizing); exercise rows
  unchanged (they're good).
- "New program" becomes a single secondary button under the picker, not in a
  mixed row.

---

## 4. Charts upgrade

- **Weight**: smooth area chart (done P4) — keep.
- **Adherence (7 days)**: new `BarChart` on Settings → Progress. Bars = daily
  completion % from `appState.completion` + supp/meal logs. Gives a real "trend"
  visual beyond a single number.
- **MacroDashboard**: already ring + animated bars — keep as the nutrition chart.
- (Later) Per-exercise volume sparkline from WorkoutSetLog — out of scope now.

---

## 5. Execution order

1. Build `Row` + `SettingsGroup`, `Segmented`, `BarChart`.
2. Rebuild Settings on grouped rows + adherence chart.
3. Nutrition dedupe (one add entry, supplements→row, drop Targets).
4. Program controls unify (overflow menu, Segmented).
5. Typecheck/lint/commit.

Guardrail: every interactive row ≥48pt, one label/sublabel/switch style sourced
from theme `typeRamp`.
