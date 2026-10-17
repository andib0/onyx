"""Task A - faithful Python port of Onyx's DailyScore + streak logic, used to build
counter-examples and probe edge cases.

Ported from (read 2026-10-17):
  mobile/contexts/TimelineContext.tsx   timelineProgressPercent  (the score)
  mobile/utils/normalize.ts             createProgramBlocks / createNutritionBlocks
  mobile/utils/trends.ts                scoreStreak (grace-day logic)
  mobile/utils/achievements.ts          longestRun / buildAchievementCtx
  mobile/app/(tabs)/focus.tsx           postScore snapshot (score = timelineProgressPercent)
  backend/src/services/sync.service.ts  STARTER_SCHEDULE / SUPPLEMENTS / MEALS

Run:  python score_audit.py
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

# ---------------------------------------------------------------- starter config
STARTER_SCHEDULE = [  # (start, end, title, tag)
    ("07:00", "07:15", "Wake + water", "Recovery"),
    ("08:00", "08:30", "Breakfast", "Nutrition"),
    ("09:00", "12:00", "Deep work", "Work"),
    ("12:30", "13:00", "Lunch", "Nutrition"),
    ("17:30", "18:30", "Train", "Training"),
    ("19:00", "19:30", "Dinner", "Nutrition"),
    ("22:30", "23:00", "Wind down", "Sleep"),
]
STARTER_SUPPS = ["Creatine", "Vitamin D3", "Omega-3", "Magnesium"]
STARTER_MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"]  # per weekday, no macro tags


def to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def program_block_count(schedule, training_day_active: bool) -> int:
    """createProgramBlocks: 1 block iff a program day is selected AND a
    warm-up/gym/Training block exists AND a later block starts after it ends."""
    if not training_day_active:
        return 0
    s = sorted(schedule, key=lambda b: to_min(b[0]))
    for i, b in enumerate(s):
        text = f"{b[2]} {b[3]}".lower()
        if "warm-up" in text or "gym" in text or b[3] == "Training":
            if i + 1 >= len(s):
                return 0
            return 1 if to_min(s[i + 1][0]) > to_min(b[1]) else 0
    return 0


def nutrition_block_count(schedule, meal_templates) -> int:
    slots = [b for b in schedule if b[3] == "Nutrition"]
    return min(len(slots), len(meal_templates))


@dataclass
class Day:
    """What the user ticks. Index-based against the starter config."""
    sched_done: set = field(default_factory=set)  # titles of ticked schedule blocks
    workout_completed: bool = False  # last set of last exercise completed
    meals_checked: int = 0  # first-N meal templates checked
    supps_taken: int = 0
    program_selected: bool = True
    schedule: list = field(default_factory=lambda: list(STARTER_SCHEDULE))
    meals: list = field(default_factory=lambda: list(STARTER_MEALS))
    n_supps: int = len(STARTER_SUPPS)


def day_score(d: Day) -> tuple[int, dict]:
    P = program_block_count(d.schedule, d.program_selected)
    N = nutrition_block_count(d.schedule, d.meals)
    S = len(d.schedule)
    K = d.n_supps
    total = S + P + N + K
    done = (
        len([b for b in d.schedule if b[2] in d.sched_done])
        + (P if d.workout_completed else 0)
        + min(d.meals_checked, N)
        + min(d.supps_taken, K)
    )
    score = round(100 * done / total) if total else 0
    return score, dict(S=S, P=P, N=N, K=K, total=total, done=done)


ALL_SCHED = {b[2] for b in STARTER_SCHEDULE}
NON_TRAIN = ALL_SCHED - {"Train"}
NON_TRAIN_NON_MEAL = ALL_SCHED - {"Train", "Breakfast", "Lunch", "Dinner"}


# ---------------------------------------------------------------- streak port
def score_streak(history: dict[str, int], today: dt.date, today_score: int,
                 threshold: int = 80, horizon: int = 365) -> int:
    m = dict(history)
    m[today.isoformat()] = today_score
    streak = 0
    last_grace = None
    start = 0 if m.get(today.isoformat(), 0) >= threshold else 1
    for days_ago in range(start, horizon + 1):
        key = (today - dt.timedelta(days=days_ago)).isoformat()
        s = m.get(key)
        if s is not None and s >= threshold:
            streak += 1
            continue
        grace = streak > 0 and (last_grace is None or days_ago - last_grace > 7)
        if grace:
            last_grace = days_ago
            continue
        break
    return streak


def longest_run(history: dict[str, int], threshold=80) -> int:
    best = run = 0
    prev = None
    for k in sorted(history):
        cur = dt.date.fromisoformat(k)
        if history[k] < threshold:
            run, prev = 0, cur
            continue
        run = run + 1 if prev and (cur - prev).days == 1 else 1
        best = max(best, run)
        prev = cur
    return best


def main():
    print("=== Score composition, starter config, program selected ===")
    s, parts = day_score(Day(sched_done=set(ALL_SCHED), workout_completed=True,
                             meals_checked=3, supps_taken=4))
    print("perfect day:", s, parts)
    T = parts["total"]
    print(f"weights per block = 1/{T} = {100 / T:.1f} pts")
    print(f"  workout (program block)        : {100 * parts['P'] / T:.1f}%")
    print(f"  'Train' schedule tick          : {100 / T:.1f}%")
    print(f"  meal checks (nutrition blocks) : {100 * parts['N'] / T:.1f}%")
    print(f"  meal schedule ticks (B/L/D)    : {300 / T:.1f}%")
    print(f"  supplements                    : {100 * parts['K'] / T:.1f}%")
    print(f"  other schedule (wake/work/wind): {300 / T:.1f}%")

    print("\n=== Counter-examples ===")
    cases = {
        "A1 skipped training, ate half portions (protein ~50%), ticked everything else":
            Day(sched_done=set(NON_TRAIN), workout_completed=False, meals_checked=3, supps_taken=4),
        "A2 skipped training but ticked 'Train' block, protein ~50%":
            Day(sched_done=set(ALL_SCHED), workout_completed=False, meals_checked=3, supps_taken=4),
        "A3 no training, no meals logged at all, only busywork + supps":
            Day(sched_done=set(NON_TRAIN_NON_MEAL), meals_checked=0, supps_taken=4),
        "B1 full program session + hit protein/kcal eating off-template, ticked nothing else":
            Day(sched_done={"Train"}, workout_completed=True, meals_checked=0, supps_taken=0),
        "B2 full session, on-target macros via 4 templates (only 3 count), no supps, no routine ticks":
            Day(sched_done={"Train", "Breakfast", "Lunch", "Dinner"}, workout_completed=True,
                meals_checked=3, supps_taken=0),
        "B3 trained 90% of sets then stopped (stop() does not set completedToday), all else done":
            Day(sched_done=set(ALL_SCHED), workout_completed=False, meals_checked=3, supps_taken=4),
        "R1 PLANNED REST DAY executed perfectly (no lifting by design)":
            Day(sched_done=set(NON_TRAIN), workout_completed=False, meals_checked=3, supps_taken=4),
        "X1 program not selected: perfect training irrelevant (P=0)":
            Day(sched_done=set(NON_TRAIN), program_selected=False, meals_checked=3, supps_taken=4),
    }
    for name, d in cases.items():
        sc, p = day_score(d)
        print(f"{sc:>4}  {'>=80 streak+' if sc >= 80 else '<80  (miss)'}  {name}   [{p['done']}/{p['total']}]")

    print("\n=== Share of max achievable without X ===")
    full = T
    no_train = full - parts["P"] - 1  # honest: don't tick Train either
    print(f"without training (honest, Train unticked): {100 * no_train / full:.1f}%")
    print(f"without training (Train ticked anyway)   : {100 * (full - parts['P']) / full:.1f}%")
    print("without hitting protein: 100% (protein grams never enter the score;"
          " a meal check = full credit regardless of portion)")
    no_tp = full - parts["P"] - 1 - parts["N"] - 3
    print(f"without training AND without any meal tick: {100 * no_tp / full:.1f}%")

    print("\n=== Dilution: workout weight vs. number of schedule blocks / supplements ===")
    for extra_sched in (0, 5, 10):
        for k in (4, 8):
            sched = list(STARTER_SCHEDULE) + [(f"2{i % 3}:0{i % 9}", f"2{i % 3}:1{i % 9}", f"Habit{i}", "Habit")
                                              for i in range(extra_sched)]
            d = Day(schedule=sched, n_supps=k)
            _, p = day_score(d)
            print(f"  schedule={len(sched):>2} supps={k}: workout weight = {100 * p['P'] / p['total']:.1f}%")

    print("\n=== Streak edge cases ===")
    today = dt.date(2026, 10, 17)
    def hist(scores_by_days_ago):
        return {(today - dt.timedelta(days=k)).isoformat(): v for k, v in scores_by_days_ago.items()}

    base = {k: 90 for k in range(1, 20)}
    # E1: single miss yesterday; morning display (today live score 20)
    h = dict(base); h[1] = 40
    print("E1 miss yesterday, morning (today=20):", score_streak(hist(h), today, 20),
          "| same day evening (today=85):", score_streak(hist(h), today, 85))
    # E2: misses exactly 7 days apart (3 and 10 days ago)
    h = dict(base); h[3] = 40; h[10] = 40
    h2 = dict(base); h2[3] = 40; h2[11] = 40
    print("E2 misses 7 days apart (d-3, d-10):", score_streak(hist(h), today, 85),
          "| 8 days apart (d-3, d-11):", score_streak(hist(h2), today, 85))
    # E3: app not opened yesterday -> no row at all
    h = dict(base); del h[1]
    print("E3 no row yesterday (no sync) morning:", score_streak(hist(h), today, 10),
          "| evening:", score_streak(hist(h), today, 85))
    # E4: 4-day/week lifter, every rest day = 93 (>=80) so rest days 'count' as streak days
    print("E4 rest-day score with program selected:", cases_score(cases, "R1"))
    # E5: history window. App calls getScores(30) -> only ~31 rows exist in the map.
    long_hist = {k: 95 for k in range(1, 400)}
    trunc = {k: v for k, v in long_hist.items() if k <= 30}
    print("E5 400-day perfect run, full history:", score_streak(hist(long_hist), today, 95),
          "| with the 30-day fetch the app actually does:", score_streak(hist(trunc), today, 95))
    print("    longest_run over 30-day fetch (feeds 'Unbreakable 30-day' badge):", longest_run(hist(trunc)) )
    # E6: achievements longestRun ignores grace -> bestStreak < currentStreak semantics differ
    h = {k: 90 for k in range(1, 30)}; h[10] = 50; h[20] = 50
    print("E6 two graced misses: current streak", score_streak(hist(h), today, 90),
          "vs longestRun", longest_run({**hist(h), today.isoformat(): 90}))
    # E7: gym_30 'Iron habit' (daysTrained over 30-day window): 4x/week lifter max
    print("E7 max workoutDone rows in a 31-row window for 4x/week lifter:", 31 * 4 // 7,
          "(badge needs 30 -> unreachable unless training ~daily)")


def cases_score(cases, prefix):
    for k, d in cases.items():
        if k.startswith(prefix):
            return day_score(d)[0]


if __name__ == "__main__":
    main()
