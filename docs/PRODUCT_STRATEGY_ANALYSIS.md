# Onyx — Comprehensive Product Analysis & Growth Strategy

Date: June 2026. Scope: the whole product as it stands after this build cycle —
mobile app (Expo/React Native), Express/Prisma/Postgres backend, single-user.
This is a strategic teardown, not a polish list. It challenges the premise, not
just the pixels.

---

## 0. The core strategic question

Onyx currently does five things: **schedule, program/training, nutrition,
supplements, daily log**. Each is competent. But the market punishes generalists:
MacroFactor owns nutrition, Hevy/Strong own lifting, Whoop owns recovery, Streaks
owns habits. A user can assemble best-in-class specialists for free.

**So why Onyx?** The only defensible answer — and it is a genuinely strong one —
is **integration**: one system that runs the *whole day* and scores it as a single
number. No specialist does cross-domain. The cross-domain **Day Score** (tasks +
training + meals + supplements, already built) is the moat. Everything in this
doc flows from one decision:

> **Commit fully to "the operating system for your day." Make the integration the
> product, not five tabs that happen to share a login.**

If that thesis isn't embraced, Onyx is four mediocre apps in a trenchcoat. If it
is, it's a category of one.

---

## 1. What works — preserve and protect

- **Cross-domain Day Score** — the unique asset. Nothing else here matters as much.
- **Per-set workout logging + rest flow + PR detection + exercise history charts** —
  now genuinely competitive with Hevy on the core loop.
- **Focus screen as a cockpit** — "what now" answered in one glance; contextual
  single-card slot is the right instinct.
- **Design system maturity** — Ring, BarChart, SettingsGroup/Row, Segmented,
  Button, glows, gradient data, mono numerals. The visual foundation is now good.
- **Backend discipline** — Zod validation, ownership checks, additive migrations.

Do not regress these while chasing new features.

---

## 2. UI design findings

Strengths (post-overhaul): consistent surfaces, gradient rings/charts, grouped
settings, animated numbers. Remaining gaps:

- **F-UI-1 (high): No light mode / no theming.** Dark-only excludes daytime
  outdoor use and a large preference segment. Theme tokens exist — a light palette
  is mechanical to add and doubles addressable comfort.
- **F-UI-2 (med): Charts are static snapshots.** No tap-to-inspect data points, no
  range toggle (week/month/all). Best-in-class trend UIs are interactive.
- **F-UI-3 (med): Iconography is functional, not branded.** Ionicons everywhere =
  generic. No custom mark, no illustration set for empty states (EmptyState uses
  a generic icon). Brand recall is near zero.
- **F-UI-4 (low): Accessibility partial.** Labels/roles added on some controls, not
  all; no Dynamic Type audit at 1.3×; color-contrast on `faint` text borderline;
  reduce-motion respected in new components but not retrofitted everywhere.
- **F-UI-5 (med): No tablet/landscape layout.** Single-column only. iPad users get
  a stretched phone.

## 3. UX design findings

- **F-UX-1 (high): Time-to-first-value is slow.** New user → register → 3-step
  onboarding → empty Focus (no schedule, default program, no meals). The "aha"
  (seeing a filled Day Score climb) is gated behind manual setup. **Seed a
  believable starter day on signup** (template schedule + the selected program's
  day + a couple of meal slots) so the first session shows a *living* dashboard,
  not blanks.
- **F-UX-2 (high): Manual data entry is the dominant friction.** Steps, sleep,
  weight, meals — all typed. Every competitor that wins automates input.
  **HealthKit / Health Connect** is the single biggest friction-killer available.
- **F-UX-3 (med): The five-tab IA assumes equal weight.** Focus is the product;
  the rest are configuration/review. Consider Focus as a true home with the others
  as drill-downs, not peers. (Tab bar is fine short-term; revisit at scale.)
- **F-UX-4 (med): No cross-domain insight surface.** Data sits in silos. Nobody
  ever tells the user "you train harder on 7h+ sleep nights" or "protein hit
  correlates with your PRs." The integration thesis demands an **Insights** view —
  this is the feature only Onyx can build.
- **F-UX-5 (low): Dead ends.** Some flows end without a next step (e.g. workout
  finished → Reset, then nothing suggests the next day).

## 4. Product logic findings

- **F-PL-1 (high): The day resets silently.** Unchecked items vanish at midnight
  with no reconciliation. History becomes lossy; the app forgets. A **day-close
  ritual** (auto or prompted) that snapshots the score builds the historical spine
  everything else (streaks, insights, recaps) depends on.
- **F-PL-2 (high): Progression engine not built.** WorkoutSetLog has the data;
  nothing computes double-progression suggestions. The program *promises* a method
  it doesn't run. (Planned — Phase 2 of program plan.)
- **F-PL-3 (med): Exercise names are free strings.** "Bench Press" ≠ "Bench press"
  silently splits history/PRs. Needs a canonical exercise library. (Planned.)
- **F-PL-4 (med): No offline-first.** Render free tier cold-starts ~30s; mutations
  fail silently offline. AsyncStorage cache + mutation queue. Gym basements are
  real.
- **F-PL-5 (med): Nutrition has no history.** Meals are checked daily but never
  totaled across time — no protein trend, no weekly average. Lifting got charts;
  nutrition deserves the same.
- **F-PL-6 (low): Notifications are fire-only.** No notification actions ("Mark
  taken" / "Log set") — every nudge forces a full app open, breaking the habit
  loop's reward immediacy.

## 5. Usability findings

- Learnability is decent post-onboarding but **discoverability is weak**: exercise
  detail (just shipped), copy-day, custom programs, caffeine cutoff are all
  undiscoverable without hunting. Need contextual hints / a one-time coachmark pass.
- Feedback is good (toasts, haptics). Error *recovery* is thin: failed saves toast
  and drop; no retry queue (ties to offline-first).
- Empty states improved but are still text+icon, not guidance-rich.

## 6. Engagement / retention / habit — the biggest opportunity

This is where Onyx is most under-built relative to its potential. Current state:
supplement streak, Day Score, PR flame, weekly recap. That's a foundation, not a
system. Mapped to the frameworks requested:

| Principle | Current | Opportunity |
|---|---|---|
| **Habit loop (cue→action→reward)** | Notifications exist; reward is a check | Close it: notification action → instant Day Score tick animation → streak feedback. Make the reward *visible and immediate*. |
| **Variable reward** | None (every check is identical) | Occasional surprise: "perfect week" confetti, randomized encouragement, a weekly "you vs last week" reveal. Predictable rewards stop releasing dopamine. |
| **Goal-gradient** | Ring shows % | Emphasize *proximity*: "2 from a perfect day" nudges harder than "85%". Surface the nearest completable goal. |
| **Zeigarnik (open loops)** | Unchecked items just sit | A gentle "3 things left, 1 tap each" close-the-loop card in the evening. |
| **Loss aversion** | Streak grace (good, ethical) | "Protect your 12-day streak — 1 supplement left" (truthful, not manipulative). |
| **Endowment** | None | "Your program," "your stack" — let users name/customize; ownership raises retention. Custom programs already help. |
| **Commitment/consistency** | None | Weekly intention-setting: "commit to 4 training days" → track against it. Public-to-self commitment. |
| **Achievement system** | PR flame only | Milestones: first PR, 10 workouts, 30-day streak, 100 sets logged. Badges = status + progress markers. |
| **Progress/completion** | Day Score, weight chart | Long-arc views: "you've trained 47 days," lifetime volume, body-weight journey. The dopamine of accumulation. |
| **Social proof / community** | None | *Selective* — see §8. Anonymous benchmarks ("top 20% adherence this week") without a full social graph. |
| **Personalization** | Targets from weight/goal | Adaptive: targets that adjust to logged trends (MacroFactor's whole pitch); smart reminder times learned from behavior. |
| **Status/recognition** | None | Levels/tiers earned by consistency; a shareable "season recap." |

**The one to build first:** close the habit loop with **immediate, visible,
slightly-variable reward** on every completion + an **achievement/milestone
system**. Cheapest dopamine-per-line-of-code in the product.

## 7. Conversion / activation

(Relevant only if Onyx goes multi-user/public.) Currently single-user personal.
If published:
- **Activation metric**: first day where Day Score > 0 with all four domains
  touched. Design onboarding to reach it in session one (ties to F-UX-1 seed day).
- **Feature adoption**: workout logging is the stickiest feature — funnel users to
  a first logged set fast (it's where the magic is).
- **Defaults**: opt-in to the highest-value notifications during onboarding (rest +
  evening check-in) — default bias drives the habit loop.
- No paywall today; if monetized, gate *insights/history depth* not core logging
  (Hevy/MacroFactor model) — never gate the habit loop itself.

## 8. Competitive positioning

| Competitor | Owns | Onyx vs |
|---|---|---|
| Hevy / Strong | Lifting logging | Onyx now competitive on core loop; behind on exercise library, social feed, templates |
| MacroFactor / MFP | Nutrition | Onyx far behind on food DB depth, barcode scan, adaptive targets |
| Whoop / Oura | Recovery/biometrics | Onyx has no biometrics (HealthKit would partially close) |
| Streaks / Fabulous | Habits | Onyx comparable on streaks, behind on habit science depth |
| Notion / structured | Daily planning | Onyx more opinionated/faster for the fitness-centric day |

**Verdict:** Don't out-feature specialists — you'll lose. Win on the **integrated
daily operating system** no one else attempts. The killer demo is the Insights
view connecting sleep → training → nutrition → outcomes. That's the wedge.

Trend alignment: AI-assisted coaching (a weekly "here's what your data says" summary
is very achievable with the logged data + an LLM), wearable integration, adaptive
programming. These are table stakes within 1–2 years.

---

## 9. Reimagined — the best version

Preserve the cockpit + logging. Add three pillars:

1. **The Daily Operating System** — Focus becomes a true command center with a
   day-close ritual that snapshots everything, building the historical spine.
2. **The Insight Engine** — the only feature competitors can't copy: cross-domain
   correlations and a weekly AI-written "your week" narrative. This is the reason
   to keep all five domains in one app.
3. **The Motivation Layer** — closed habit loop, achievements, milestones, adaptive
   personalization, ethical loss-aversion. Turns a tracker into something you
   *can't stop* using.

Plus the friction-killers: HealthKit autofill, offline-first, notification actions.

---

## 10. Prioritized roadmap

### Now (high impact, low–med effort)
1. **Seed a starter day on signup** (kills empty first-run). [F-UX-1]
2. **Day-close ritual + score snapshot** (historical spine; unlocks streaks/insights). [F-PL-1]
3. **Achievements/milestones + immediate visible reward on completion** (motivation). [§6]
4. **Notification actions** ("Mark taken"/"Log"). [F-PL-6]
5. **Progression engine** (program plan Phase 2 — promised method, finally runs). [F-PL-2]

### Next (high impact, med–high effort)
6. **HealthKit / Health Connect autofill** (steps/sleep/weight/HR). [F-UX-2] — needs EAS dev build.
7. **Offline-first cache + mutation queue.** [F-PL-4]
8. **Nutrition history + trends** (protein/calorie charts, parity with lifting). [F-PL-5]
9. **Canonical exercise library + autocomplete.** [F-PL-3]
10. **Insights v1** — 2–3 hard-coded cross-domain correlations + weekly narrative. [F-UX-4]

### Later (strategic bets)
11. **AI weekly coach** (LLM over logged data — Claude API; the differentiator).
12. **Light mode + theming + tablet layout.** [F-UI-1, F-UI-5]
13. **Adaptive targets** (MacroFactor-style) + learned reminder times.
14. **Selective social** — anonymous benchmarks, optional accountability partner.
15. **Brand identity pass** — custom mark, illustration set, interactive charts.

### Housekeeping debt (do continuously)
- Web `src/` deletion (dead code), Vercel teardown.
- Render free DB expiry (recurring — paid tier or Neon/Supabase).
- Accessibility audit (Dynamic Type, contrast, full reduce-motion retrofit).

---

## 11. Instrument these (you can't improve what you don't measure)
- Day-1 activation: % new users reaching Day Score > 0 across all 4 domains.
- D1/D7/D30 retention.
- Habit-loop completion rate: notification → action taken.
- Feature adoption: % users logging ≥1 set, ≥1 meal, doing evening check-in.
- Streak distribution; median active streak length.
- Time-to-first-value (signup → first meaningful interaction).

---

## 12. The one-paragraph thesis

Onyx's competitors are better at any single thing it does. Its only winning move
is to be the one place that runs the entire day and tells you what the whole
picture means — a daily operating system with a closed habit loop and an insight
engine no specialist will ever build. Stop adding parallel features; start
connecting the ones you have. Seed value on day one, snapshot every day to build
the spine, reward every completion immediately, and once there's enough history,
let the data (and an LLM) coach the user. That is the product worth building.
