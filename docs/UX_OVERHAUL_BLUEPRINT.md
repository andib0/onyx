# Onyx — App-Wide UX/UI Overhaul Blueprint

Audit date: June 2026. Scope: mobile app (`mobile/`), all five tabs plus stack screens (Supplements management, Log), auth flow, and the engagement layer that doesn't exist yet. Every finding references the actual implementation, not hypotheticals.

---

## 1. UX Audit Findings

### F-1. Focus screen carries too many jobs (severity: high)
Focus currently renders up to **nine sections**: greeting, hero block, take-now supplements, training, macro dashboard, meals checklist, supplements checklist, day progress, evening check-in, yesterday recap. That's a feed, not a focus screen. Miller's Law: users can hold ~4 meaningful chunks; we present 9.

**Direction:** Focus shows at most four chunks at any moment: (1) the one thing to do now, (2) today's score/progress, (3) one contextual prompt (check-in in the evening, recap in the morning — never both), (4) quick stats. Everything else lives on its own tab and is reachable in one tap.

### F-2. Focus vs Today overlap (severity: high)
Both screens render the timeline (Focus summarized, Today in full). Two places answer "what's my day look like" — users won't know which is canonical. Redundant interaction path.

**Direction:** Today = the schedule (view + edit). Focus = the *current moment* only. Remove TimelineSummary from Focus, replace with a one-line "Day: 7/12 done · next 14:30" row that deep-links to Today.

### F-3. Checklists duplicated across tabs (severity: medium)
Meals + supplements checklists appear on Focus *and* Nutrition. Double bookkeeping in the user's head ("did I check it there or here?"). State is shared so no data bug, but it inflates both screens.

**Direction:** Checking happens where the user is (keep on both short-term), but Focus shows only *unchecked* items, collapsed to the next 1–2 due. Completed items disappear from Focus entirely (they remain visible on Nutrition).

### F-4. No onboarding path (severity: high)
New user lands on Focus with empty schedule, empty meals, no program → mostly empty cards and a ProgramSetupModal. First-session value is near zero; this is where retention dies.

**Direction:** 3-step onboarding after registration: (1) pick program (existing picker UI reused), (2) bodyweight + protein target confirmation (prefills nutrition), (3) optional notification permission. Under 60 seconds, every step skippable. Seed a default schedule template so Day 1 is never blank.

### F-5. Jargon (severity: medium)
"Blocks", "RIR", "Stack", "Take now", "recomp". Jakob's Law: match user vocabulary. RIR is fine for the gym audience but needs a one-time tooltip; "blocks" should become "schedule" / "tasks"; "Stack" → "Supplements".

### F-6. Friction points in core loops
- Checking a meal requires finding it in a list — no "next meal" shortcut on Focus hero when a meal block is active (MealFocus context exists in `useActiveContext` but isn't exploited for one-tap check).
- Workout start is two screens away when on Nutrition/Today (no global "training day" affordance). Acceptable; don't over-fix.
- Grams slider saves on release — good — but there's no quick-portion presets (e.g. 100/150/200g chips) for common amounts.
- Evening check-in dismiss is per-render state, not persisted: dismiss → app restart → card returns same evening. Persist dismissal per date in AsyncStorage.

---

## 2. UI Audit Findings

- **Card monotony:** every section is the same surface card. Hierarchy is flat — hero and footnote get equal visual weight. Von Restorff: nothing pops because everything is identical.
- **Greeting block** is strong (title-size, mono date) — keep as the anchor.
- **Buttons:** `Button` primary uses accent bg + dark label — good contrast. But several screens still have bespoke Pressables (program day buttons, copy button) — migrate all to `Button`/variants.
- **Delete affordances** (`✕`) are small text glyphs with hitSlop 8–10. Fitts: replace with 44×44 icon buttons (Ionicons `trash-outline`, muted) or swipe-to-delete.
- **ChecklistSection rows**: check target is the checkbox only (presumed); whole row should toggle.
- **Icons** now real (Ionicons) on tab bar — extend into section titles (small leading icon) and empty states. No illustrations anywhere; one simple empty-state graphic per tab would lift perceived quality (Aesthetic-Usability).
- **Supplement color `#baFFF8`** is nearly white at small sizes — reads as broken on checkmarks. Replace (see color system).

---

## 3. Navigation Architecture

Current: `Focus · Today · Program · Nutrition · Settings` + stack: `/supplements`, `/log`.

Verdict: **structure is right** (5 tabs, Jakob-compliant). Adjustments:

1. Rename **Today → Schedule** (the tab is an editor/list; "Today" semantically collides with Focus).
2. Tab order by frequency: `Focus · Nutrition · Program · Schedule · Settings`. Nutrition is touched 3–6×/day (meals), Program 1×/day, Schedule occasionally.
3. `/log` stays buried under Settings → correct for a secondary surface; rename link "History & trends".
4. `/supplements` management reachable from Nutrition — correct. Remove any other entry points.

---

## 4. Screen-by-Screen Opportunities

### Focus
- Apply F-1/F-2/F-3: hero + score row + contextual card + compact macro ring. Target: full screen fits in ~1.5 viewport heights.
- Hero block becomes **actionable**: when active block is a meal → inline "Mark eaten" button; supplement window → inline checks (already done); training day + no active block → "Start workout" CTA in hero.
- Morning (before noon): recap card visible. Evening (after 19:00): check-in card visible. Never both. Daytime: neither.
- One primary CTA per state (Von Restorff): the hero button is the only filled-accent element on screen.

### Schedule (Today)
- Timeline rows: increase row height to ≥56px, whole-row toggle, time column in mono.
- "Show all / upcoming" toggle moved from old web Topbar — verify it exists on mobile; if not, add segmented control at top.
- Add block: floating action button (FAB, bottom-right) — platform-expected pattern.

### Program
- Picker redesign already done (vertical cards, radio). Remaining: collapse picker after selection — show selected program as a single compact row with "Change" link (progressive disclosure, Hick). Day selector + session list become the default view.
- Exercise rows: add per-exercise history sparkline later (uses WorkoutSetLog data).

### Nutrition
- MacroDashboard ring is now the anchor — keep at top.
- Meals: quick-portion chips (100/150/200g) beside slider.
- Food search: collapse behind "+ Add food" button instead of always-rendered section (Hick; the search UI is visual noise 95% of the time).
- Supplements section: collapsed list showing only unchecked count when all-but-n done.

### Settings
- Fine post-redesign. Add: notification preferences (once notifications land), units (kg/lb), caffeine cutoff edit (currently backend-only preference with no UI).

### Auth
- Add "continue as guest/demo" consideration only if app goes public; otherwise leave.

---

## 5. Component System

| Component | Action |
|---|---|
| `Button` | Done. Enforce everywhere; delete bespoke Pressable buttons. |
| `Card` | Add `variant="hero"` (slightly elevated, accent border) and `variant="quiet"` (no border, bg-only) to create 3 hierarchy levels. |
| `ChecklistSection` | Whole-row tap, completed-collapse, haptic on toggle, optional max-visible with "show n more". |
| `Ring` | Add reanimated fill-on-mount (300ms ease-out) — single highest-value polish item. |
| `Stepper` | Still used in workout — good there. Don't reuse for forms (check-in already migrated off). |
| `IconButton` (new) | 44×44, replaces all ✕/glyph buttons. |
| `EmptyState` (new) | Icon + one line + one CTA. Used on every tab when data missing. |
| `FAB` (new) | Schedule add-block. |

---

## 6. Design System Recommendations

- Formalize spacing rhythm: screens use `gap: lg (16)`; sections internally `sm/md`. Document: 4/8/12/16/20/28/40 only — no raw numbers in styles (audit shows a few `paddingVertical: 14`, `height: 42` strays).
- Elevation language: borders-on-dark only (current) — keep, but reserve `borderLight` for interactive surfaces, `border` for static.
- Motion: one system — 200ms ease-out for state changes, 300ms for mount reveals; reanimated already installed and unused.

## 7. Typography

- Keep system sans for UI (correct mobile choice — Jakob) + **mono numerals as brand signature** (timers, macros, weights). This pairing is already distinctive; lean in: every number in the app should be mono. Audit: checklist sublines and some stats still sans.
- Scale: 11/12/14/16/18/24/30/44 — fine. Enforce: screen title 30, card title 16/600, body 14, caption 12, micro-label 11 uppercase +1 tracking.
- Line-height: add explicit lineHeight on body text (14 → 20) — several dense paragraphs render cramped.
- `fonts.brand` (Palatino) is unused — either brand the greeting/logo with it or delete.

## 8. Color System

Current: bg `#0b0f14`, accent `#7aa2ff`, good `#36d399`, warning `#fbbf24`, danger `#ef4444`, supplement `#baFFF8`.

- **Replace `supplement` `#baFFF8`** → teal `#2dd4bf` (visible at small sizes, distinct from `good`).
- **`muted` rgba(255,255,255,0.68)** on `bg` ≈ 4.4:1 — passes AA for large text only. Body text set in muted at 12–14px fails. Bump muted to 0.72 and add `subtle` 0.55 for true captions ≥? No — keep two tiers: `muted` 0.75 (readable secondary), `faint` 0.5 (decorative only, never for information).
- Semantic discipline: green = completion only, accent = action/interactive only, amber = warning/over-target only. Audit violations: rest timer uses green (it's a countdown, not a completion) — acceptable but consider accent; streak uses green — correct.
- Emotional anchor: consider a single warm accent moment — workout-complete screen tinted `good` is the one celebratory surface. Keep celebrations rare so they register.

## 9. Accessibility

- Tap targets: enforce 44pt minimum (delete buttons, checklist checkboxes, tab bar OK).
- Add `accessibilityLabel`/`accessibilityRole` to Checkbox, Ring (announce "1,420 of 2,600 calories"), IconButton.
- Dynamic Type: RN `allowFontScaling` default on — verify layouts at 1.3× (timer screens will clip; set `maxFontSizeMultiplier` 1.4 on hero numerals).
- Color-only signals: checked state currently color+strikethrough (good); over-target ring amber + add "over" text label.
- Reduce motion: gate ring/mount animations behind `AccessibilityInfo.isReduceMotionEnabled`.

## 10. Behavioral Psychology Implementation

| Principle | Concrete change |
|---|---|
| **Hick** | Focus = 1 CTA per state; food search behind "+ Add food"; program picker collapses after choice; settings stays 3 groups. |
| **Fitts** | 44pt targets; primary CTA full-width bottom of card (thumb zone); FAB bottom-right; whole-row toggles. |
| **Jakob** | Tab bar icons (done); FAB for add; pull-to-refresh (exists); swipe-to-delete on list rows; "Schedule" naming. |
| **Miller** | Max 4 sections per screen; checklists collapse completed; recap = 4 stats not paragraphs (done). |
| **Von Restorff** | Exactly one filled-accent element per screen; streak flame as the single colored badge on Focus header. |
| **Aesthetic-Usability** | Ring animations, empty-state illustrations, consistent mono numerals, celebration screen on workout complete. |
| **Goal-gradient effect** | Ring + "412 kcal left" framing (done — "left" framing beats "consumed"); show "1 set left" in workout list. |
| **Endowed progress** | Day score starts with any completed item visible ("2/9 already done"). |
| **Peak-end rule** | Workout-complete stats screen is the peak; evening check-in save = end-of-day moment — add a one-line positive summary after save ("Day logged — 86% complete"). |

Ethical line: no dark patterns — streaks never guilt ("streak lost" messaging stays neutral), notifications always per-category opt-in, no fake urgency.

## 11. Retention & Habit Mechanisms

The habit loop: **cue → action → reward → investment**.

1. **Cue = push notifications** (the single biggest missing piece). Local notifications: supplement times, next-block start, rest-timer end, evening check-in at 20:00. Each individually toggleable.
2. **Action** = one-tap from notification (notification actions: "Mark taken").
3. **Reward** = unified **Day Score** (blocks + meals + supplements weighted), shown as the Focus ring; streak counts days ≥80%. Workout-complete celebration. Weekly recap (Monday morning: weight delta, adherence %, total sets, PRs).
4. **Investment** = logged sets/weights make next session smarter ("beat last session" prefill — already built); the more they log, the better the app coaches.

PR detection: WorkoutSetLog already stores everything needed — flag when weight×reps beats exercise history; toast + flame on the set. Cheap, high reward.

## 12. Onboarding Optimization

- Steps: program → bodyweight/targets → notifications. Skippable, <60s.
- First-run Focus shows a "getting started" checklist card (add first meal, do first workout, log first evening) — endowed progress: registration counts as step 1 of 4, pre-checked.
- Empty states everywhere double as onboarding ("No meals yet → Add your first meal").

## 13. Conversion Optimization

(Personal-use today; relevant if published.) Registration is the only gate: add Apple Sign-In (App Store requirement if any social login), defer registration until after a demo Focus screen if going public. Not a current priority.

## 14. User Journey Map (target state)

- **07:00** wake → notification "Morning recap ready" → Focus: recap stats + first supplements → 2 taps, done.
- **12:30** meal notification → notification action "Mark eaten" → no app open needed.
- **17:00** gym → Focus hero "Start Push day" → per-set logging, rest timers, complete screen.
- **20:00** check-in notification → Focus check-in card → 3 numbers, save → "Day 86%".
- **Monday 08:00** weekly recap → weight trend + adherence → adjust targets.

Friction budget: every loop above ≤3 taps from notification.

## 15. Engagement Loop Design

Daily loop: notification → one-tap action → Day Score increment → ring fills → streak.
Weekly loop: Monday recap → visible trend → target adjustment → renewed goal.
Monthly loop (later): program progression suggestions from accumulated set logs.

## 16. Prioritized Roadmap

### Quick wins (days, high impact)
1. Focus diet: remove TimelineSummary, collapse checklists to unchecked-only, morning/evening contextual card logic (F-1/F-2/F-3).
2. Persist check-in dismissal per date.
3. `supplement` color → `#2dd4bf`; muted contrast bump.
4. Whole-row checklist toggle + haptics + 44pt targets + IconButton.
5. Ring mount animation (reanimated).
6. Food search behind "+ Add food"; program picker collapse-after-select.
7. Rename Today → Schedule; reorder tabs.

### Medium (1–2 weeks, high impact)
8. **Local notifications + notification actions** (the retention engine).
9. Unified Day Score + streak on Focus.
10. Onboarding flow (3 steps + getting-started card).
11. PR detection + workout celebration screen.
12. Empty states + EmptyState component.
13. Weekly recap screen.

### Long-term
14. HealthKit/Health Connect autofill (steps/sleep/weight) — kills manual entry.
15. Offline-first cache + mutation queue (Render cold starts).
16. Per-exercise progress charts from WorkoutSetLog.
17. Card hierarchy variants + illustration pass.
18. Program progression engine (suggest weight increases from history).

---

**North star:** Focus screen answers "what do I do right now?" in one glance and one tap; everything else is one tab away; the app pings you at the right moment instead of waiting to be opened; every number you give it makes tomorrow's guidance better.
