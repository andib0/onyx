# 06 · UX, behavior design and accessibility audit

**Scope:** `mobile/` (Expo Router) plus the backend paths it depends on. This is a static read of the code at HEAD, plus the uncommitted `api/client.ts` change. Nothing was run on a device.
**Owner outcome under test:** *"Every morning I open Onyx and within 10 s I know exactly what to do today. Logging a meal, a set or a supplement takes ≤ 2 taps from Focus and ≤ 5 seconds."*
**Method:** I traced `onPress` handlers, navigation, sheets and modals by hand. Two scripts in the session scratchpad `…/scratchpad/ux/` produced the numbers: `contrast.mjs` computes WCAG 2.x ratios from `mobile/theme.ts` (output in `contrast.tsv`), and `touchables.mjs` inventories every `Pressable`/`Touchable*`/`IconButton` in `app/` and `components/` (output in `touchables.txt`).
**Date:** 2026-10-17

---

## 0. Verdict in one paragraph

The owner outcome is **not met today**, and the gaps are mostly structural rather than visual polish:

- **Logging targets:** 4 of the 11 traced actions meet the ≤ 2-tap target. Four of them (ad-hoc food, barcode, morning weight/sleep, "all morning supplements") take 4–6 taps across 2–3 screens.
- **Cold start:** the app needs the network before it can show anything. With a sleeping Render instance, the first launch of the day is a spinner of about a minute. Offline, a likely outcome is the login screen.
- **Workout program:** the program day never advances on its own. Every day is a training day, so the Push session is prescribed every day until the user changes it by hand.
- **Mechanics that work against the user:**
  - The streak disappears the morning after a miss, even though the grace day would restore it later that day.
  - The Getting-Started card blocks the evening check-in, which is its own last step.
  - The insights reward unlocks on day 14, which is exactly when users like the red-team persona quit.
- **Accessibility:** core text passes. Semantic colors used as text fail in light mode (`good` 3.35, `warning` 3.13, `supplement` 2.78, `faint` 2.92). Every border or unchecked-checkbox outline is about 1.2:1. 23 small buttons are 36 pt, including the workout End/Pause/Skip controls.

---

## 1. Tap counts (cold start = Focus already rendered, data loaded)

Legend: **T** = taps, **I** = text inputs (keyboard), **S** = screens or sheets visited after Focus, **↓** = needs a scroll on a 390×844 phone.

| # | Action | Path traced in code | T | I | S | ≤ 2 T? |
|---|---|---|---|---|---|---|
| 1 | **Log a set** (workout active, values prefilled) | `WorkoutSection.tsx:269` "Set N done" → `useWorkout.ts:283 completeSet` | **1** | 0 | 0 | ✅ |
| 1b | Log the first set of the day | Compact card "Start" (`IdleView.tsx:38`, ↓ below hero, see §2) → "Set 1 done" | 2 (+↓) | 0 | 0 | ✅ borderline |
| 1c | First set when the program day is wrong (the usual case, §4.3) | Program tab → day pill (`program.tsx:267`) → Focus tab → Start → Set done | **5** | 0 | 1 | ❌ |
| 1d | First-ever session (no history) | reps/kg are empty (`WorkoutSection.tsx:78-95`) → type both | 2 | **2** | 0 | ❌ (> 5 s) |
| 2 | **Mark workout done** | No direct action. `completedToday` is set only when the *last set of the last exercise* is logged (`useWorkout.ts:359-366`). "End" (`WorkoutSection.tsx:287`) resets without counting. Seed programs average 330 sets / 22 days ≈ **15 sets per session**. | **≈ 16** | 0–30 | 0 | ❌ |
| 3 | **Log a planned meal** | Active meal block "Mark eaten" (`focus.tsx:480-490`), or the "Meals to eat" row (`focus.tsx:550`, ↓) | **1** | 0 | 0 | ✅ |
| 3b | 4th+ meal of the day | "+N more" (`ChecklistSection.tsx:97`) → Nutrition tab → ↓ → checkbox | 2–3 | 0 | 1 | ⚠️ |
| 4 | **Ad-hoc food (search)** | Nutrition tab → ↓ to "Add food or supplement" row (`nutrition.tsx:559`, *below* macros, the 7-day chart and the meal list) → type query → result "Add" (`FoodSearchSection.tsx:79`) → close sheet → ↓ find new card → checkbox (`MealCard.tsx:54`) → optionally a grams chip | **5–6** | 1 | 2 | ❌ |
| 4b | Ad-hoc food via "Recent" | same, minus the text input | 5 | 0 | 2 | ❌ |
| 5 | **Scan barcode** | Nutrition → ↓ Add row → "Scan barcode" (`nutrition.tsx:493`) → [first time: "Allow camera"] → aim → auto-add (`nutrition.tsx:138-146`) → close sheet → checkbox → grams | **5–6** | 0 | 3 | ❌ |
| 6 | **Take one supplement** | "Take now" row (`focus.tsx:510`), or the Supplements checklist (`focus.tsx:564`, ↓) | **1** | 0 | 0 | ✅ |
| 6b | **Take "all morning"** (3 starter supplements at 08:00) | No bulk action exists anywhere (grep "all/bulk" returns nothing). One tap per item, and each checked row *vanishes and reflows* (`focus.tsx:169-183`). | **3** | 0 | 0 | ❌ |
| 6c | From the notification | Expand notification → "Mark taken" (`NotificationResponder.tsx:26`), once *per supplement* | 1 per item | 0 | 0 | ✅ |
| 7 | **Tick a schedule block** (e.g. "Deep work") | `FocusBlockPanel` offers an action only for meal or gym blocks (`focus.tsx:479-498`). Otherwise: Day-score card or Schedule tab → row (`BlockItem.tsx:38`) | **2** (+↓ later in the day) | 0 | 1 | ✅ borderline |
| 8 | **Log bodyweight (morning)** | Not on Focus before 19:00. Settings tab → ↓ "Full history & trends" (`settings.tsx:242`) → ↓ Weight field (`log.tsx:~205`) → type → "Add Entry" (`log.tsx:268`) | **4** | 1 | 2 | ❌ |
| 9 | **Log sleep (morning)** | same path as #8 | **4** | 1 | 2 | ❌ |
| 10 | **Evening check-in** | Notification "Log now" → Focus (`NotificationResponder.tsx:29`). The card renders *only if* the Getting-Started card is done or dismissed (§4.1). Then 3 fields + Save (`DayCheckInCard.tsx:106-150`). | **4** | 3 | 0 | ❌ |
| 11 | **See "what's next today"** | Focus shows "Up next" *only when no block is active* (`focus.tsx:127-149`). The full list is on the Schedule tab. `nextBlock` is the first block *in sortOrder* with `start > now`, not the earliest one (`useActiveContext.ts:120-126`). | 0–1 | 0 | 0–1 | ⚠️ correctness bug |

**Score: 4 actions fully meet the target (1, 3, 6, 7). 3 are partial (1b, 3b, 11). 4 fail (2, 4/5, 6b, 8/9/10).** Three causes account for every fail:
1. Body metrics have no home on Focus.
2. Food logging is modeled as *editing a weekly plan*. `handleAddFoodToDay` → `addMealTemplateForDay(selectedMealDay)` (`nutrition.tsx:188-196`, `useMeals.ts:84-92`) creates a **recurring Monday template**, unchecked. A one-off snack is then re-prompted every week, inflating the Nutrition badge and "Meals to eat".
3. There are no batch actions: no "take all", and no "mark workout done".

### 1.1 Is five tabs right?

The current tabs are Focus · Nutrition · Program · Schedule · Settings (`(tabs)/_layout.tsx`). Problems:
- **Settings hides the whole progress loop.** Insights, Achievements, the weight trend and History all sit under Settings (`settings.tsx:219-242`). Bodyweight logging, the user's most frequent metric, is 2 levels deep in a utility tab.
- **Schedule duplicates Focus.** It also shows derived supplement, meal and program rows as read-only dots that never display a done state (`BlockItem.tsx:28-56`, `isCompleted` reads `completionByBlockId` only). It contradicts the "8/15 done" header above it.
- **Nutrition holds both plan editing and daily logging.** "Add" lives at the bottom of the screen.

**Proposed structure (4 tabs + a global quick-log):**

| Tab | Contents |
|---|---|
| **Today** | Now/Next strip, one primary action card, a compact timeline with inline checkboxes (absorbs Schedule), and a morning "Weigh-in & sleep" chip row |
| **Train** | Program + active workout + exercise detail |
| **Eat** | Today's intake (log) at the top, Plan (templates) as a segment, Supplements as a segment |
| **Progress** | Trends, insights, achievements, history |
| Settings | Avatar button in the Today header (not a tab) |
| **Quick-log "+"** | Persistent on Today: Food (recents first), Scan, Weight, Sleep, Water. One-off entries go into the *day log*, not into templates. |

| Action | Now | Proposed |
|---|---|---|
| Log set | 1–5 | **1** (training card pinned to the top while active; the day auto-advances, §4.3) |
| Mark workout done | ≈ 16 | **2** ("Done — didn't log sets" → confirm) |
| Planned meal | 1 | **1** |
| Ad-hoc food (recent) | 5 | **2** (+ → recent item; logged as eaten, undo toast) |
| Ad-hoc food (search) | 5–6 + I | **2** + I |
| Barcode | 5–6 | **2** (+ → Scan; auto-log with undo) |
| One supplement | 1 | **1** |
| All morning supplements | 3 | **1** ("Take all 3" in the Take-now header) |
| Schedule block | 2 | **1** (inline checkbox on the Today timeline) |
| Bodyweight | 4 + I | **1–2** (stepper prefilled with yesterday's value) |
| Sleep | 4 + I | **1–2** (same morning chip) |
| Evening check-in | 4 + 3I | **2** (prefilled, only the fields not logged that morning) |
| What's next | 0–1 | **0** |

---

## 2. "Within 10 s I know what to do today": what Focus shows

Render order is `focus.tsx:337-575`. Spacing is `ScreenContainer` padTop 20 / gap 16 / card padding 16. The usable viewport on a 390×844 iPhone, after the status bar (≈ 59) and the absolute tab bar (84), is **≈ 700 pt**. The table uses the starter seed at **08:05 on day 2**.

| # | Element | ≈ height | Cum. | Numbers / items it adds |
|---|---|---|---|---|
| 1 | Error banner (only if load failed) | 0–40 | – | – |
| 2 | Greeting + date + sync pill + time glyph | 80 | 100 | date |
| 3 | **Contextual slot** (one of GettingStarted 230 / CheckIn 260 / Weekly / **Recap 110**) | 110 | 226 | 3–4 (tasks x/y, meals, "missed" n, streak) |
| 4 | Day-score card (Ring 72 + "x/y done" + 🔥 streak) | 104 | 346 | 3 |
| 5 | Insights teaser (from day 4, *above* the hero, `focus.tsx:452`) | 0–110 | 346–456 | 1–2 |
| 6 | Focus panel(s): every *active* block, else "Up next" (Breakfast 08:00–08:30 + "Mark eaten") | 200 per block | 562 | 3 (2 times, "min left") |
| 7 | "Take now (3/3)" supplements (08:00 ± 60 min horizon) | 210 | **772 → cut off** | 1 + 3 rows |
| 8 | Compact workout card "Start" | 90 | 878 ↓ | 1 |
| 9 | Protein card + "Meals to eat" (≤ 3) | 330 | ↓ | 3–4 |
| 10 | "Supplements · n/m taken" (≤ 3) | 220 | ↓ | 1 + rows |

Findings:
- **About 12–15 distinct numbers and 4 cards compete above the fold.** None is designated *the* next action. There are three equal-weight CTAs: "Mark eaten" in the panel, 3 checkboxes in Take-now, and the Day-score card, which is itself a navigation target with no affordance and no accessibility role.
- **The hero is not first.** Yesterday's recap and the score ring (both *review*) render above "what to do now" (*act*). The comment at `focus.tsx:168`, "Focus = act, not review", is contradicted by the order. From day 4 the Insights teaser pushes the hero down another ~110 pt.
- **Multiple active blocks stack.** Overlapping blocks each render a 200-pt panel (`focus.tsx:473-506`), which dilutes the hero further.
- **The workout is below the fold on training days** until the gym block is active (`focus.tsx:521`). At 08:05 the user cannot see from the first screen that today is a training day.
- **"What's next" disappears whenever any block is active** (`focus.tsx:128-135`). During "Deep work 09:00–12:00" the user has no visibility of lunch or training without leaving Focus.
- **Proposed fix:** a single **Now / Next strip** at the top: "Now: Breakfast · Mark eaten" plus "Next: Deep work 09:00 · Train 17:30 (Push)". Below it, one primary action card, then everything else collapsed. Move Recap and Insights below the action list (or into Progress).

---

## 3. Behavioral mechanics against the evidence

| Mechanic | Implementation | Evidence | Assessment |
|---|---|---|---|
| **Daily score streak** | `scoreStreak` (`trends.ts:27-58`): consecutive days with score ≥ **80 %**, where the score is done/total over *all* timeline items (`TimelineContext.tsx:99-115`). The starter day has **15 items**: 7 schedule blocks + 1 program block + 3 meal slots + 4 supplements. That is 12 / 15 per day, including "Wind down 22:30". Items are double-counted: "Breakfast" is both a schedule tick *and* a meal check (`normalize.ts:104-131`). | Lally et al. 2010 (EJSP 40:998): automaticity took a median of **66 days** (range 18–254), and **missing a single opportunity did not materially affect** habit formation. Silverman & Barasch 2023 (JCR 49:1095): highlighting a **broken** streak lowers later engagement. The effect is stronger when people blame themselves and **attenuated when the streak can be "repaired"**. | ⚠️ An 80 % *composite* threshold makes most real days fail. The habit chain tracks app hygiene (ticking "Wind down") rather than the 3 target behaviors. Recommend per-behavior streaks (trained per plan, protein hit, supplements) or a lower composite threshold, and remove the duplicate items. |
| **Grace day** (f0d4c32) | One sub-threshold day per rolling 8 scanned days is forgiven, but **only if `streak > 0` at that point in the backward scan** (`trends.ts:49-50`). Scanning starts from yesterday when today is below 80 (`trends.ts:40`). | Sharif & Shu ("emergency reserves" research, UCLA/Wharton; OBHDP 2019 on persistence after failure): goals with slack produce more persistence after a missed sub-goal, because people perceive progress. Silverman & Barasch: repairability blunts the broken-streak penalty. | ❌ **It backfires exactly when it matters.** The morning after a miss, yesterday is scanned first with `streak == 0`, so no grace is applied and the streak reads **0**. The 🔥 line disappears (`focus.tsx:443`) and so does the recap streak (`RecapCard.tsx:39`). The streak "comes back" only after the user reaches 80 % *today*, and nothing tells them so. The user sees a broken streak at the highest-risk moment, which is the "what-the-hell" trigger (Polivy & Herman 1985; Cochran & Tesser 1996). Fix: apply grace to the most recent day first, and say so: "6-day streak · grace day used — keep it alive today". |
| **Fresh start** | None. Monday shows a Weekly recap card (`focus.tsx:313`); there is no new-week or new-month framing after a lapse. | Dai, Milkman & Riis 2014 (Mgmt Sci 60:2563): temporal landmarks (new week, month, birthday) increase goal-initiation behavior. | Missing opportunity. After ≥ 2 missed days, open with "New week, clean slate" instead of yesterday's deficits. |
| **Yesterday recap** | Morning card with "**N missed**" supplements in warning amber (`RecapCard.tsx:33-37`). Tasks are "x/7", which ignores the program, meals and supplements that the score counted. | Loss framing after failure lowers re-engagement (Silverman & Barasch, above). | ⚠️ The first thing seen each morning is a deficit. Reframe it as today's plan ("3 supplements at 08:00") and suppress it after a miss. |
| **Notifications** | `notifications.ts`. Defaults: supplements **off**, check-in **off**, rest **on** (`:12-16`). Onboarding "Enable reminders" turns on **check-in + rest only** (`onboarding.tsx:282-291`). Supplement reminders are one **DAILY repeating** notification per supplement at `timeAt` (`:91-114`); the starter seed fires **3 simultaneous banners at 08:00** plus 1 at 22:00. Check-in is **DAILY at 20:00** (`:18,116-132`). **Nothing is cancelled or suppressed** when the item is already done or logged. The check-in hour disagrees with the card (`DayCheckInCard.tsx:12` = 19). No adaptive logic, no quiet days, no rate cap. | Nahum-Shani et al. 2018 (Ann Behav Med 52:446), JITAI framework: deliver support only at moments of **vulnerability or opportunity and receptivity**, and *not* when unnecessary. Mehrotra et al. 2016 (CHI): receptivity depends on content relevance and timing. | ❌ These are static, unconditional reminders. A user who logged at 19:30 is still nagged at 20:00, and one who took creatine at 07:55 still gets 3 pings at 08:00. Fix: schedule one-shot notifications for *today only*, rescheduled on app open. Cancel when done, batch same-time supplements into one notification with a "Take all" action, and back off after 3 ignored notifications. Gate the check-in at 19 or 20 consistently, and only when not yet logged. |
| **Implementation intentions** | Onboarding asks for program, weight and reminders (`onboarding.tsx:240`, 3 steps). It never asks **when or where** the user will train, nor their wake time. The starter schedule hard-codes Train at 17:30 (`sync.service.ts:9`). | Gollwitzer & Sheeran 2006 (Adv Exp Soc Psychol 38:69): meta-analysis of 94 studies, if-then plans improve goal attainment with a medium-to-large effect, **d = 0.65**. | ❌ This is the highest-leverage omission. Add a 4th step: "I'll train on [Mon/Wed/Fri] at [time] at [place]". It seeds the program block and the weekday rotation (fixes §4.3) and anchors the notification. |
| **Achievements** | 11 badges (`achievements.ts:33-45`), computed from **`getScores(30)`** only (`DataContext.tsx:304`, `scores.service.ts:40`). Consequences: "Iron habit: Train 30 days" needs 30 workouts *within a 30-day window*, which is effectively impossible with rest days. "Unbreakable" and "Committed" are capped by the window. Unlocks can regress on `/achievements`. "First steps" unlocks on simply opening Focus, because a 0 % score row is posted (`focus.tsx:267-298`). A toast reads "Achievement unlocked!" without saying which one (`focus.tsx:257`). | Endowed progress (Nunes & Drèze 2006, JCR 32:504) supports the free first step. Goal gradient (Kivetz, Urminsky & Zheng 2006, JMR 43:39): effort accelerates near a *visible* goal. Neither is shown on Focus. | ⚠️ Fix the windowing (use all-time counts server-side), name the badge in the toast, and show "2 workouts to Gym rat" near the workout card (goal gradient). |
| **Insights** | Unlock at **14 score-days** (`insights.ts:4`). Thresholds are n ≥ 3 per group and a ≥ 10 pp effect. "Training lifts everything" (`insights.ts:87-110`) is **circular**: workout completion is *in* the score denominator, so trained days are mechanically higher. | Reward timing: a reward that arrives at the drop-off point does not prevent the drop-off. | ⚠️ The payoff lands on day 14, the persona's quit day. Ship a day-3 "first pattern" (e.g. "you hit protein on 2/3 training days") and exclude workout from the score before correlating it. |
| **Evening check-in** | A card from 19:00 with 3 typed fields; morning-native metrics (weight, sleep) are collected at night. It can be blocked by Getting-Started (§4.1). | Weigh-in and sleep recall are most accurate on waking. Context-cued habits (Wood & Neal 2007) need a *stable* cue. | ⚠️ Split it: a **morning** chip for weight + sleep (cue: first open), and an evening card for steps + notes. |

---

## 4. Red team: "I quit after two weeks"

Persona: an intermediate lifter on "Lean Bulk – 3 Day PPL" who trains Mon/Wed/Fri, iPhone, gym basement with no signal.

**Onboarding (register → `onboarding.tsx`).**
- Picks the program, enters a weight, taps "Enable reminders" (check-in + rest only).
- Two inputs never asked for: *training days* and *time*.
- `seedStarterData` fills in a stranger's day (07:00 wake, 09:00–12:00 deep work, 17:30 train, 4 supplements, 4 meals × 7 weekdays) (`sync.service.ts:4-26`). None of it is the user's own.

**Day 1, 13:00 (first Focus).**
- The slot shows **Getting started 2/4** (`focus.tsx:309`). Above the fold: greeting, checklist, score ring "0/15".
- The workout card is below the fold.
- The persona ticks Lunch, sees the item vanish (`focus.tsx:185-195`), and gets an "Achievement unlocked!" toast for… opening the app.

**Day 1, 20:00.**
- The check-in notification fires; "Log now" opens Focus.
- **§4.1 blocking bug:** the slot is still `gettingStarted`, because `gettingStartedDone` requires `logEntries.length > 0` (`focus.tsx:234-235`). The check-in card can never render while Getting-Started is visible (`focus.tsx:309-312`).
- The notification promised "30 seconds" and the app shows a checklist whose unchecked step is the very card it hides.
- The only routes left are dismissing the card with the ✕ or Settings → History → form.
- **First friction spike.**

**Day 2, 07:30 (Render cold start, §4.2).**
- `AuthProvider.restoreSession` makes a **network refresh** before any UI (`AuthContext.tsx:43-75`), followed by `getMe`. Only after both does `exportUserData` run: a *full export* of all history, with no local persistence of `appState` (`DataContext.tsx:288-298`). Note: AGENTS.md's claim that state is cached in AsyncStorage `andi_weekday_os_v1` is stale; only `clearStorage` still references that key.
- Render's free tier sleeps after 15 min idle and takes "about one minute" to spin back up (render.com/docs/free). `fetch` has **no timeout** (`client.ts:126`).
- Expected first-open-of-the-morning experience: **~60 s of a bare `ActivityIndicator`** (`_layout.tsx:28-33`, no copy), then a skeleton. That is six times the owner's 10-second budget.
- If the waking instance returns a non-JSON error page, `response.json()` throws, the refresh is treated as a network error, `user` stays `null`, and `index.tsx` **redirects to Login**. This is inferred from the code path and should be verified on device.

**Day 2, morning (first miss).**
- Day 1 scored about 40 %, so the streak is 0 and nothing is lost yet.
- The recap card shows **"4 missed"** supplements in amber.
- Morning weigh-in has no home on Focus (§1 #8).

**Day 3 (first workout, Wednesday; the persona trains Mon/Wed/Fri).**
- **§4.3:** `selectedProgramDayId` defaults to `days[0]` and **never advances** (`useProgram.ts:67-71, 82-91`; no other writer except the Program tab pill). `trainingDayActive = !!selectedProgramDay` (`useProgram.ts:113`), so **every calendar day is "Push"**. The "Rest day" card (`WorkoutSection.tsx:99-108`) is unreachable once a program is chosen.
- The program block is in the score on rest days, so rest days cost 1/15 and the "Training lifts everything" insight is circular.

**Day 3, at the gym (offline, §4.4).**
- The app was warm, so Focus loads.
- "Start" → `startWorkoutSession` fails silently (`useWorkout.ts:269-273`) → `sessionIdRef` stays null → **every set is skipped server-side** (`useWorkout.ts:326-349`, `if (sessionId)`). The mutation queue covers only completion/meal/supplement toggles (`mutationQueue.ts`, call sites `useCompletion.ts:40`, `useMeals.ts:41`, `useSupplements.ts:44`).
- No pill, no toast. `getExerciseHistory` also fails, so there is no prefill or progression suggestion, and every set needs typed kg/reps (§1 #1d).
- Workout state is in-memory React state: an iOS memory kill between sets loses the session.
- "End" is a 36-pt danger button 1 slot from "Pause" with **no confirm** (`WorkoutSection.tsx:278-293`, `useWorkout.ts:541-546`). One sweaty mis-tap discards the session and does not mark the day trained.
- If the app was *cold*-started in the basement, the persona never gets past auth (see Day 2).
- **The workout the persona cares most about leaves no trace.** This is the likely quit trigger.

**Day 4–6 (missed workout).**
- Friday is skipped. Saturday morning shows **streak gone** (grace not applied to the most recent day, §3), amber "missed", and the same Push day still prescribed.
- The 20:00 notification still fires every night regardless.

**Day 7–13 (data-entry burden).**
- The persona logs a protein shake via search: 5–6 taps (§1 #4). It becomes a **permanent Monday template** (`useMeals.ts:84`), so next Monday's Focus lists "Protein shake" under "Meals to eat" and the Nutrition badge counts it (`(tabs)/_layout.tsx:263-265`).
- The persona now maintains a plan instead of logging a day.
- Each cold morning adds the ~1-minute spinner (`exportUserData` grows with history: `sync.service.ts:278-285` exports everything).

**Day 14.**
- Insights finally unlock (`insights.ts:4`). By then the persona has had:
  - roughly 10 cold-start waits;
  - 14 unconditional 20:00 pings;
  - a lost gym session;
  - a streak that vanished twice;
  - the wrong workout prescribed on 4 of 5 training days.

### Break points ranked by quit risk

| # | Break point | Evidence | Severity |
|---|---|---|---|
| 1 | Offline or cold start blocks the app; cold Render ≈ 60 s | `AuthContext.tsx:43-75`, `DataContext.tsx:288`, `client.ts:126` | Critical |
| 2 | Offline workout silently not saved; End without confirm; in-memory session | `useWorkout.ts:269-349, 541` | Critical |
| 3 | Program day never advances / every day is training | `useProgram.ts:67-113` | High |
| 4 | Getting-Started blocks the check-in (its own step 4) | `focus.tsx:234-235, 309-312` | High |
| 5 | Streak shown as 0 the morning after a miss despite grace | `trends.ts:40-50` | High |
| 6 | Ad-hoc food = recurring template, 5–6 taps | `nutrition.tsx:188`, `useMeals.ts:84` | High |
| 7 | Static, unconditional notifications | `notifications.ts:91-132` | Medium |
| 8 | Composite 80 % of 15 items incl. duplicates | `TimelineContext.tsx:52-115`, `normalize.ts:69-131` | Medium |
| 9 | "Up next" ignores time order; hidden when any block is active | `useActiveContext.ts:120-126`, `focus.tsx:128` | Medium |
| 10 | Achievement windowing (30 d) makes "Iron habit" unattainable | `DataContext.tsx:304`, `achievements.ts:73-86` | Low |
| 11 | Hard-coded "Lean bulk pace" note shown to cut/recomp users | `settings.tsx:221`, `log.tsx:156` | Low |

---

## 5. Accessibility

### 5.1 Contrast: every token pair, both palettes (`contrast.mjs`, alpha composited over the background)

**160 pairs computed. 69 fail their threshold (4.5:1 text, 3:1 UI); 41 are below 3:1.** The workhorses pass:

| | dark: bg / surface / surface2 / hover | light: bg / surface / surface2 / hover |
|---|---|---|
| `text` | 17.16 / 16.07 / 14.72 / 12.94 ✅ | 14.78 / 16.06 / 14.28 / 13.19 ✅ |
| `muted` (126 text uses) | 7.27 / 7.08 / 6.73 / 6.19 ✅ | 5.16 / 5.33 / 5.08 / 4.91 ✅ |

**Failures (ratio; ✗ = below 3:1, fails even large text):**

| Token used as text | Dark | Light | Where it bites |
|---|---|---|---|
| `faint` (7 uses) | 3.80 / 3.82 / 3.76 / 3.60 (large only) | **✗ 2.88 / 2.92 / 2.85 / 2.80** | chart axis labels `BarChart.tsx:131`, `WeightTrend.tsx:177`, `insights.tsx:175,180`, `settings.tsx:400` |
| `good` (26 uses) | ✅ 9.15–6.79 | 3.07 / 3.35 / **✗ 2.96 / 2.72**; on `tint.good` **✗ 2.96** | 🔥 streak line `focus.tsx:647-650` (12 pt, on surface = 3.35 ✗), "Perfect day", RecapCard ✓ |
| `warning` (8) | ✅ | **✗ 2.86** / 3.13 / **✗ 2.76 / 2.54**; on tint **✗ 2.74** | Recap "missed", SyncStatusPill |
| `supplement` (7) | ✅ | **✗ 2.55 / 2.78 / 2.46 / 2.26** | supplement checks, Take-now |
| `accent` | 4.45 (surface2), 3.89 (hover), 4.02 (on tint) | 4.46 (surface2), 4.10 (hover), 4.42 (on tint) | pressed rows, chip labels |
| `accent2` | ✅ | 3.12 / 3.41 / 3.01 / **✗ 2.77** | |
| `danger` | 4.44 (surface2), 3.88 (hover), 4.31 (on tint) | 4.27 (bg), 4.12, 3.79, 4.05 (on tint) | error banner `focus.tsx:633` (danger on tint.danger) |
| `timeSun` | ✅ | **✗ 2.92** / 3.19 / **✗ 2.81 / 2.59** | greeting glyph (graphic, needs 3:1) |
| TAG `Sleep #a78bfa` / `Recovery #f472b6` | ✅ | **✗ 2.49–2.72 / 2.43–2.65** | block borders. Also `TAG_COLORS` is built from the *module-load* palette (`theme.ts:238-247`), so it does **not** follow the live theme toggle. |

| Ink on fill | Dark | Light |
|---|---|---|
| `onFill` (#fff) on `good` (checked checkbox ✓) | **✗ 2.13** | 3.35 |
| `onFill` on `supplement` (checked supplement ✓) | **✗ 1.86** | **✗ 2.78** |
| `onFill` on `warning` | **✗ 2.08** | 3.13 |
| `onFill` on `accent` / `danger` | 3.72 / 3.73 (large only) | ✅ |
| `onAccent` on `accent` (tab badge, primary button) | ✅ | ✅ |

| Non-text UI (needs 3:1, WCAG 1.4.11) | Dark | Light |
|---|---|---|
| `border` (**unchecked checkbox outline** `Checkbox.tsx:43`, input outlines, Stepper buttons) | **✗ 1.20 / 1.24** | **✗ 1.22 / 1.23** |
| `borderLight` (Stepper input) | **✗ 1.55 / 1.62** | **✗ 1.39 / 1.40** |
| `accentDim` (focus/pressed ring) | **✗ 1.77 / 1.79** | **✗ 1.61 / 1.64** |
| `supplement` as a check fill | ✅ | **✗ 2.55 / 2.78** |

The unchecked checkbox, the single most important control in the app, is effectively invisible to low-vision users in both themes (≈ 1.2:1). Fixes:
- Raise light `good` to about `#0f7f55`, `warning` to `#9a6200`, `supplement` to `#0b7f73`, and `faint` alpha to ≥ 0.58.
- Use a dedicated `controlBorder` token of ≥ 3:1 (e.g. white 0.38 on dark, slate 0.45 on light).
- Use `onAccent`-style dark ink on the green and teal fills in dark mode.

### 5.2 Touchables (`touchables.mjs`)

- **62 touchables** in `app/` and `components/`. **21 (34 %)** set `accessibilityLabel` and **25** set `accessibilityRole`. `Button`, `IconButton`, `FAB` and `SettingsRow` primitives label themselves, so most text buttons are fine.
- **Icon-only touchables lacking a label: 0.** `IconButton` requires `label`, which is good.
- **Glyph-only or graphic touchables with no meaningful label: 7 sites.**
  - `components/ui/Stepper.tsx:41` "−" and `:59` "+". No role and no label; the screen reader hears "minus" and "plus" with no field context. The `TextInput` at `:47` also has no label (the "KG"/"REPS" text is not associated). Used for set logging (`WorkoutSection.tsx:250,259`) and onboarding weight.
  - `components/shared/Checkbox.tsx:51`: `role="checkbox"`, **no label**. Used standalone in `components/nutrition/MealCard.tsx:54`, where it is announced as "checkbox, not checked" with no meal name. Nested inside labeled rows in `ChecklistSection.tsx:63-80` and `BlockItem.tsx:52`, it creates **duplicate focus stops**. Fix: set `accessible={false}` when inside a row.
  - `components/nutrition/MyFoodsSection.tsx:46`: text "x" (remove), announced as "x".
  - `components/ui/Sheet.tsx:66` and `components/ui/ConfirmModal.tsx:43`: full-screen backdrop `Pressable` with no label or role. Set `accessibilityLabel="Close"` or `accessible={false}` and rely on `onRequestClose` / escape.
- **35 text-bearing touchables with no `accessibilityRole`.** They are not announced as buttons. Most important:
  - the Day-score card `focus.tsx:412`;
  - the sync retry banner `focus.tsx:348`;
  - InsightsTeaser `:48,75`;
  - ProteinCard `:31`;
  - the "+N more" link `ChecklistSection.tsx:98` (it also shows a *chevron-down* but navigates away);
  - exercise jump rows `WorkoutSection.tsx:305`;
  - food Add/Save `FoodSearchSection.tsx:79,86`;
  - the full list is in `touchables.txt`.

**Targets below 44 × 44 pt:**

| Control | Size | Sites |
|---|---|---|
| `Button size="sm"` | minHeight **36** (`Button.tsx:141`) | **23 uses**, including the gym-critical **Pause / End** (`WorkoutSection.tsx:279-293`), **Undo / +30 s / Skip rest** (`RestView.tsx:65,74,82`), "Scan barcode", quick-add "Add", "Train again", onboarding "Skip" |
| `ChipSelector` chip | minHeight **32**, no hitSlop (`ChipSelector.tsx:70`) | Nutrition weekday selector |
| MealCard gram presets | minHeight **28**, no hitSlop (`MealCard.tsx:190`) | |
| SupplementForm tier chips | ≈ 25 tall, no hitSlop (`SupplementForm.tsx:132`) | |
| Food "Add / Save", My-Foods "Add / x" | ≈ 25 + hitSlop 8 ≈ 41 (`FoodSearchSection.tsx:157`, `MyFoodsSection.tsx:89`) | |
| Supplement library "Add" | ≈ 25 + 16 ≈ 41 (`supplements.tsx:384`) | |
| Supplements "Clear Checks" | ≈ 33, no hitSlop (`supplements.tsx:175,329`) | |
| `Checkbox` | 22–24 + hitSlop 8 = **38–40** | standalone in `MealCard.tsx:54` (rows elsewhere are full-width, fine) |
| `Segmented` | minHeight **40** (`Segmented.tsx:111`) | |

**Other accessibility issues:**
- **Dynamic Type:** no `maxFontSizeMultiplier` anywhere. Fixed-height Stepper (52) and Ring layouts will clip at accessibility sizes; this needs a device check.
- **Reduced motion:** respected in 14 files, but **ignored on Focus** (`focus.tsx:358,366,411`: `FadeInDown`/`ZoomIn` unconditional) and in `Toast.tsx`.
- **Focus checklists remove checked rows instantly** (`focus.tsx:169-195`). For a VoiceOver user, focus jumps to an unrelated element after every check, and there is no undo on Focus.

---

## 6. Prioritized recommendations

1. **Local-first cold start.**
   - Persist the TanStack Query cache (`@tanstack/query-async-storage-persister`) and render Focus from cache immediately.
   - Restore the session from the stored token without blocking on `/auth/refresh`.
   - Add a 10 s `AbortController` timeout.
   - Keep the Render instance warm, or move off the free tier.
   - Treat a refresh network error as "offline, stay signed in".
2. **Offline-safe workouts.** Persist the active session in AsyncStorage, queue `startWorkoutSession` and `logWorkoutSet` through the mutation queue with client IDs, confirm "End", and make Pause/End/Skip ≥ 44 pt.
3. **Program rotation.** Advance `selectedProgramDayId` after a finished session and add per-weekday rest days. Ask for training days and time at onboarding (implementation intention), and drop the program block from the score on rest days.
4. **Focus = one next action.** Now/Next strip at the top → a single primary card → collapsed rest. Move Recap and Insights below or into Progress. Show today's workout headline above the fold on training days.
5. **Quick-log "+" with day-log semantics** (food/scan/weight/sleep/water at ≤ 2 taps), "Take all" for same-time supplements, and "Mark workout done".
6. **Fix the slot priority.** Show the check-in above Getting-Started after 19:00, or render both, and unify `CHECK_IN_HOUR`.
7. **Streak repair UX.** Apply grace to the most recent miss, display "grace used", and use per-behavior streaks or a lower threshold. Add fresh-start framing after lapses.
8. **JITAI-lite notifications.** Today-only one-shots, cancel on completion, batch same-time supplements, back off when ignored.
9. **Contrast and target pass.** Token fixes per §5.1, a `controlBorder` token, `size="sm"` min 44, Stepper and Checkbox labels, roles on Pressable cards.

## Sources

- Lally, van Jaarsveld, Potts & Wardle (2010). *How are habits formed: Modelling habit formation in the real world.* Eur J Soc Psychol 40(6):998–1009.
- Gollwitzer & Sheeran (2006). *Implementation intentions and goal achievement: A meta-analysis of effects and processes.* Adv Exp Soc Psychol 38:69–119.
- Silverman & Barasch (2023). *On or Off Track: How (Broken) Streaks Affect Consumer Decisions.* J Consumer Research 49(6):1095–1117. https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb · https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions
- Sharif & Shu: emergency reserves / goal slack. UCLA dissertation (https://escholarship.org/uc/item/3vm2h8gj); OBHDP 2019, "Nudging persistence after failure through emergency reserves" (https://anderson-review.ucla.edu/emergency-reserves/)
- Polivy & Herman (1985). *Dieting and binging: A causal analysis.* Am Psychol 40(2):193–201. Cochran & Tesser (1996), the "what-the-hell" effect.
- Dai, Milkman & Riis (2014). *The Fresh Start Effect.* Management Science 60(10):2563–2582.
- Nahum-Shani et al. (2018). *Just-in-Time Adaptive Interventions (JITAIs) in Mobile Health.* Ann Behav Med 52(6):446–462.
- Mehrotra et al. (2016). *My Phone and Me: Understanding People's Receptivity to Mobile Notifications.* CHI '16.
- Kivetz, Urminsky & Zheng (2006). *The Goal-Gradient Hypothesis Resurrected.* J Marketing Research 43(1):39–58.
- Nunes & Drèze (2006). *The Endowed Progress Effect.* J Consumer Research 32(4):504–512.
- Wood & Neal (2007). *A new look at habits and the habit–goal interface.* Psychol Rev 114(4):843–863.
- Render, Free instance spin-down (15 min idle, ~1 min spin-up): https://render.com/docs/free
- WCAG 2.2 SC 1.4.3 (Contrast Minimum), 1.4.11 (Non-text Contrast), 2.5.8 (Target Size). Apple HIG minimum target 44 × 44 pt.
