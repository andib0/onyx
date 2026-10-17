"""Task B - simulated Onyx user histories, emitted in the app's own table shapes.

Output (./sim_out/): CSV files named and columned after the Prisma models so the
SAME feature code (features.py) can later run on a real export:

  user_preferences.csv  userId, timezone, proteinTarget, plannedDays (EXTRA: see below)
  daily_log.csv         userId, date, day, bw, sleep, steps, top, notes, createdAt
  workout_session.csv   id, userId, date, programDayName, startedAt, endedAt, durationSeconds
  workout_set_log.csv   userId, sessionId, exerciseName, setNumber, weightKg, reps, createdAt
  completion.csv        userId, blockId, date, isComplete, completedAt
  supplement_log.csv    userId, supplementId, date, isTaken, takenAt
  meal_log.csv          userId, mealTemplateId, date, isEaten, eatenAt, protein, calories
                        (protein/calories = macros of the eaten template; in the real
                         DB join MealLog -> MealTemplateTag)
  daily_score.csv       userId, date, score, tasksDone, ..., workoutDone, protein, calories
  _truth.csv            latent state (stress, motivation, illness, travel) -- NEVER used
                        as a feature; only for diagnostics.

Generative assumptions (each is a cited, *directional* finding; magnitudes are my
choices, not estimates from the papers):
  G1 Short sleep -> less next-day exercise. Baron et al. 2013 J Clin Sleep Med 9(8);
     Kline 2014 Am J Lifestyle Med 8(6) review. Sleep debt also delays wake / first log.
  G2 Weekend effect: later sleep/wake (social jetlag, Roenneberg et al. 2012 Curr Biol
     22(10)), higher intake & weight on weekends (Racette et al. 2008 Obesity 16(8);
     Orsama et al. 2014 Obes Facts 7(1)).
  G3 Fresh-start effect: more gym visits at week/month starts (Dai, Milkman & Riis 2014
     Manage Sci 60(10)).
  G4 "What-the-hell" / abstinence-violation effect: a lapse raises the chance of
     further lapses (Polivy & Herman 1985 Am Psychol 40(2); Cochran & Tesser 1996).
     Lally et al. 2010 Eur J Soc Psychol 40(6) found ONE missed opportunity did not
     materially derail habit formation -> trait varies across users (some ~0).
  G5 Self-monitoring decays over months (Burke, Wang & Sevick 2011 J Am Diet Assoc
     111(1); Helander et al. 2014 JMIR 16(4) app-usage drop-off); lower monitoring
     co-occurs with worse adherence.
  G6 Gym habit needs ~4 sessions/wk for ~6 wk (Kaushal & Rhodes 2015 J Behav Med 38(4));
     motivation modelled as slowly-mean-reverting AR(1) with habit build-up.
  G7 Stress episodes reduce exercise and shift eating (Stults-Kolehmainen & Sinha 2014
     Sports Med 44(1)). ASSUMPTION (not from literature): work-stress episodes ramp up
     over 1-4 days before peaking; illness has no ramp (unpredictable). This ramp is
     what makes *any* leading indicator possible in the simulation.

The leading-indicator result is therefore conditional on these assumptions. The
simulation validates the METHOD (no leakage, time split, metrics, rerun path),
not the finding.

Run: python simulate.py --users 16 --days 730 --seed 7
"""
from __future__ import annotations

import argparse
import datetime as dt
import os

import numpy as np
import pandas as pd

START = dt.date(2024, 10, 7)  # a Monday
SCHED = ["wake", "breakfast", "deepwork", "lunch", "train", "dinner", "winddown"]
SCHED_TIME = dict(wake=7.0, breakfast=8.0, deepwork=9.0, lunch=12.5, train=17.5, dinner=19.0,
                  winddown=22.5)
SUPPS = [("creatine", 8.0), ("vitd3", 8.0), ("omega3", 8.0), ("magnesium", 22.0)]
MEALS = [("breakfast", 0.25), ("lunch", 0.30), ("dinner", 0.30), ("snack", 0.15)]  # share of target
EXERCISES = ["Bench", "Row", "Squat", "OHP", "RDL", "Pulldown"]


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def make_traits(rng, i):
    archetypes = ["steady", "perfectionist", "night_owl", "stress_prone", "fader"]
    a = archetypes[i % len(archetypes)]
    t = dict(
        archetype=a,
        base=rng.normal(1.6, 0.35),            # logit P(train | planned, neutral)
        sleep_sens=rng.uniform(0.25, 0.6),     # per hour below 7h
        wth=rng.uniform(0.0, 0.3),             # what-the-hell (logit penalty after miss)
        weekend_drop=rng.uniform(0.2, 0.6),
        chrono=rng.normal(7.4, 0.4),           # baseline first-log hour
        sleep_base=rng.normal(7.1, 0.3),
        log_consc=rng.normal(1.6, 0.3),        # logit P(log a given item)
        stress_rate=1 / rng.uniform(28, 45),   # episodes per day
        decay=rng.uniform(0.0, 0.0008),        # engagement decay per day (G5)
        n_planned=int(rng.choice([3, 4, 4, 5])),
        protein_target=int(rng.choice([130, 140, 150, 160])),
        kcal_target=int(rng.choice([2300, 2500, 2700])),
        bw0=rng.normal(80, 6),
    )
    if a == "perfectionist":
        t["wth"] = rng.uniform(0.6, 1.0)
    if a == "night_owl":
        t["chrono"] += 1.5; t["sleep_base"] -= 0.4; t["sleep_sens"] += 0.2
    if a == "stress_prone":
        t["stress_rate"] = 1 / rng.uniform(14, 20)
    if a == "fader":
        t["decay"] = rng.uniform(0.0015, 0.0025)
    plans = {3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4]}  # Mon=0
    t["planned"] = plans[t["n_planned"]]
    return t


def stress_series(rng, n, rate):
    """Episodes: work-stress (ramp 1-4 d, plateau 2-6 d) and illness (no ramp)."""
    s = np.zeros(n); ill = np.zeros(n, bool); travel = np.zeros(n, bool)
    d = 0
    while d < n:
        if rng.random() < rate:
            ramp = rng.integers(1, 5); plat = rng.integers(2, 7); amp = rng.uniform(0.6, 1.4)
            for k in range(ramp):
                if d + k < n: s[d + k] = max(s[d + k], amp * (k + 1) / (ramp + 1))
            for k in range(plat):
                if d + ramp + k < n: s[d + ramp + k] = max(s[d + ramp + k], amp)
            d += ramp + plat
        elif rng.random() < 1 / 70:
            L = rng.integers(2, 6); ill[d:d + L] = True; d += L
        elif rng.random() < 1 / 160:
            L = rng.integers(5, 12); travel[d:d + L] = True; d += L
        else:
            d += 1
    return s, ill, travel


def ts(date: dt.date, hour: float) -> str:
    hour = float(np.clip(hour, 0.0, 23.99))
    return (dt.datetime.combine(date, dt.time()) + dt.timedelta(hours=hour)).isoformat()


def simulate_user(rng, uid, t, n_days):
    stress, ill, travel = stress_series(rng, n_days, t["stress_rate"])
    rows = {k: [] for k in ["daily_log", "workout_session", "workout_set_log", "completion",
                             "supplement_log", "meal_log", "daily_score", "truth"]}
    m = 0.0; habit = 0.0; missed_prev_planned = False; bw = t["bw0"]
    last_sleep = t["sleep_base"]
    for i in range(n_days):
        date = START + dt.timedelta(days=i)
        dow = date.weekday()
        weekend = dow >= 5
        s = stress[i]
        # motivation AR(1) + fresh-start + habit (G3, G6)
        m = 0.93 * m + rng.normal(0, 0.18) - 0.15 * s
        fresh = 0.35 if dow == 0 else 0.0
        fresh += 0.25 if date.day == 1 else 0.0
        engage_trend = -t["decay"] * i
        # sleep for the night BEFORE this date (G1, G2): Fri/Sat nights longer+later
        sleep = (t["sleep_base"] + (0.6 if dow in (5, 6) else 0) - 0.9 * s
                 + (0.8 if ill[i] else 0) - (0.4 if travel[i] else 0) + rng.normal(0, 0.55))
        sleep = float(np.clip(sleep, 3.5, 10.5))
        debt = max(0.0, 7.0 - sleep)
        # did the user open the app at all (missed sync -> no rows) (G5)
        p_open = sigmoid(2.6 + 0.6 * m - 0.6 * s + 1.0 * engage_trend - (2.0 if travel[i] else 0)
                         - (0.6 if ill[i] else 0))
        opened = rng.random() < p_open
        # first-log hour: chronotype + weekend + stress + sleep debt + low motivation (G2, G7)
        first_log = (t["chrono"] + (1.2 if weekend else 0) + 0.9 * s + 0.35 * debt
                     - 0.4 * m - 0.8 * engage_trend + rng.normal(0, 0.45))
        p_item = sigmoid(t["log_consc"] + 0.7 * m - 0.9 * s + 1.0 * engage_trend
                         - (0.5 if weekend else 0))
        # training decision
        planned = dow in t["planned"]
        logit = (t["base"] + 0.7 * m + 0.6 * habit - 1.1 * s - t["sleep_sens"] * debt
                 - (t["weekend_drop"] if weekend else 0) + fresh
                 - (t["wth"] if missed_prev_planned else 0)
                 - (3.0 if ill[i] else 0) - (2.2 if travel[i] else 0) + rng.normal(0, 0.5))
        if planned:
            trained = rng.random() < sigmoid(logit)
        else:
            trained = rng.random() < sigmoid(logit - 3.3)
        if planned:
            if not trained:
                m -= 0.25 * t["wth"]  # abstinence violation spills into motivation (G4)
            missed_prev_planned = not trained
        habit = 0.97 * habit + (0.05 if trained else 0.0)
        # nutrition (G2, G7)
        p_ratio = float(np.clip(rng.normal(0.97 + 0.08 * m - 0.12 * s - (0.07 if weekend else 0)
                                           - (0.15 if ill[i] else 0), 0.12), 0.3, 1.6))
        k_ratio = float(np.clip(rng.normal(1.0 + (0.12 if weekend else 0) + 0.08 * s
                                           + (0.12 if missed_prev_planned else 0) * t["wth"], 0.12),
                                0.5, 1.8))
        protein = t["protein_target"] * p_ratio
        kcal = t["kcal_target"] * k_ratio
        bw += (kcal - t["kcal_target"] * 1.0) / 7700 + rng.normal(0, 0.03)
        bw_obs = bw + rng.normal(0, 0.35) + (0.3 if dow == 0 else 0)

        rows["truth"].append(dict(userId=uid, date=date.isoformat(), stress=s, motivation=m,
                                  illness=ill[i], travel=travel[i], sleep_true=sleep,
                                  planned=planned, trained=trained, opened=opened,
                                  protein_true=protein, kcal_true=kcal))
        # workout session happens irrespective of whether the app's other parts are used;
        # a trained day without the app opened is NOT recorded (realistic: the session is
        # logged in-app). We record a session if trained and (opened or 85% chance).
        sess_logged = trained and (opened or rng.random() < 0.5)
        if sess_logged:
            sid = f"{uid}-s{i}"
            start_h = SCHED_TIME["train"] + rng.normal(0.3 * s + (0.5 if weekend else 0) - 6.5 * (dow >= 5), 0.6)
            start_h = float(np.clip(start_h, 6.0, 21.5))
            planned_sets = 18
            done_sets = planned_sets if rng.random() > 0.12 + 0.1 * s else int(rng.integers(8, 17))
            dur = done_sets * 3.2 * 60 + rng.normal(0, 300)
            rows["workout_session"].append(dict(id=sid, userId=uid, date=date.isoformat(),
                                                programDayName="Day", startedAt=ts(date, start_h),
                                                endedAt=ts(date, start_h + dur / 3600),
                                                durationSeconds=int(dur)))
            for k in range(done_sets):
                rows["workout_set_log"].append(dict(userId=uid, sessionId=sid,
                                                    exerciseName=EXERCISES[k // 3], setNumber=k % 3 + 1,
                                                    weightKg=round(60 + 10 * rng.random(), 1),
                                                    reps=int(rng.integers(5, 11)),
                                                    createdAt=ts(date, start_h + k * 3.2 / 60)))
            workout_done = done_sets == planned_sets
        else:
            workout_done = False
        if not opened:
            continue  # no completions/supps/meals/score row: missed sync
        # schedule completions
        tasks_done = 0
        for b in SCHED:
            if b == "train":
                done = trained or rng.random() < 0.25  # busywork tick without training
            else:
                done = rng.random() < p_item
            if done:
                tasks_done += 1
                h = max(first_log, SCHED_TIME[b] + abs(rng.normal(0.3, 0.4)))
                rows["completion"].append(dict(userId=uid, blockId=b, date=date.isoformat(),
                                               isComplete=True, completedAt=ts(date, h)))
        supp_done = 0
        for name, hr in SUPPS:
            p = p_item + (0.05 if name != "magnesium" else -0.1)
            if rng.random() < p:
                supp_done += 1
                h = max(first_log, hr + abs(rng.normal(0.2, 0.5)))
                rows["supplement_log"].append(dict(userId=uid, supplementId=name,
                                                   date=date.isoformat(), isTaken=True,
                                                   takenAt=ts(date, h)))
        meals_done = 0; prot_logged = 0.0; kcal_logged = 0.0
        for j, (name, share) in enumerate(MEALS):
            if rng.random() < p_item:
                h = max(first_log, [8.0, 12.5, 19.0, 16.0][j] + abs(rng.normal(0.3, 0.5)))
                pr = protein * share; kc = kcal * share
                if j < 3: meals_done += 1
                prot_logged += pr; kcal_logged += kc
                rows["meal_log"].append(dict(userId=uid, mealTemplateId=name, date=date.isoformat(),
                                             isEaten=True, eatenAt=ts(date, h),
                                             protein=round(pr, 1), calories=round(kc)))
        # evening check-in -> DailyLog (sleep = previous night, as typed in check-in card)
        if rng.random() < sigmoid(t["log_consc"] - 0.6 + 0.8 * m - 0.8 * s + 1.0 * engage_trend):
            rows["daily_log"].append(dict(userId=uid, date=date.isoformat(),
                                          day="Train" if planned else "Rest",
                                          bw=f"{bw_obs:.1f}", sleep=f"{sleep:.1f}",
                                          steps=str(int(max(500, rng.normal(8000 + 2500 * trained - 2000 * s, 1800)))),
                                          top="", notes="",
                                          createdAt=ts(date, 19.0 + abs(rng.normal(0.8, 0.9)) + 0.6 * s)))
        total = 15
        done = tasks_done + int(workout_done) + meals_done + supp_done
        rows["daily_score"].append(dict(userId=uid, date=date.isoformat(),
                                        score=round(100 * done / total), tasksDone=tasks_done,
                                        tasksTotal=7, suppDone=supp_done, suppTotal=4,
                                        mealsDone=meals_done, mealsTotal=4,
                                        workoutDone=workout_done, protein=round(prot_logged),
                                        calories=round(kcal_logged)))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=16)
    ap.add_argument("--days", type=int, default=730)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "sim_out"))
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)
    os.makedirs(a.out, exist_ok=True)
    allrows = {}
    prefs = []
    for u in range(a.users):
        uid = f"sim{u:02d}"
        t = make_traits(rng, u)
        prefs.append(dict(userId=uid, timezone="Europe/Belgrade",
                          proteinTarget=f"{t['protein_target']} g/day",
                          kcalTarget=t["kcal_target"],
                          plannedDays=",".join(str(d) for d in t["planned"]),
                          archetype=t["archetype"], **{k: t[k] for k in
                                                      ["base", "wth", "sleep_sens", "decay"]}))
        r = simulate_user(rng, uid, t, a.days)
        for k, v in r.items():
            allrows.setdefault(k, []).extend(v)
    pd.DataFrame(prefs).to_csv(os.path.join(a.out, "user_preferences.csv"), index=False)
    for k, v in allrows.items():
        name = "_truth" if k == "truth" else k
        pd.DataFrame(v).to_csv(os.path.join(a.out, f"{name}.csv"), index=False)
    tr = pd.DataFrame(allrows["truth"])
    pl = tr[tr.planned]
    print(f"users={a.users} days/user={a.days} user-days={len(tr)} planned={len(pl)} "
          f"miss_rate={1 - pl.trained.mean():.3f} open_rate={tr.opened.mean():.3f}")
    print(pl.assign(miss=~pl.trained).groupby(pl.userId).miss.mean().round(2).to_dict())


if __name__ == "__main__":
    main()
