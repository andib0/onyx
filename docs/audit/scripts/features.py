"""Build a leakage-safe (user, date) feature panel from Onyx tables.

Input: a directory of CSVs with Prisma column names (see simulate.py docstring or the
SQL in docs/audit/04-score-and-prediction.md). Works unchanged on a real export.

Every feature for target day t at lead L uses ONLY rows dated <= t-L (end of that
day). Rolling baselines use strictly earlier days. Target-day calendar attributes
(weekday, planned-or-not) are known in advance and are allowed.
"""
from __future__ import annotations

import os

import numpy as np
import pandas as pd


def _hour(s: pd.Series) -> pd.Series:
    t = pd.to_datetime(s, errors="coerce")
    return t.dt.hour + t.dt.minute / 60.0


def load(dirpath: str) -> dict[str, pd.DataFrame]:
    out = {}
    for name in ["user_preferences", "daily_log", "workout_session", "workout_set_log",
                 "completion", "supplement_log", "meal_log", "daily_score"]:
        p = os.path.join(dirpath, f"{name}.csv")
        out[name] = pd.read_csv(p) if os.path.exists(p) and os.path.getsize(p) > 2 else pd.DataFrame()
    return out


def parse_target(s) -> float:
    try:
        return float(str(s).split()[0].split("-")[-1])
    except Exception:
        return np.nan


def daily_panel(T: dict[str, pd.DataFrame], am_cutoff_hour: float = 11.0,
                am_supps: set | None = None) -> pd.DataFrame:
    prefs = T["user_preferences"].set_index("userId")
    users = prefs.index.tolist()
    frames = []
    dates_all = pd.concat([T[k]["date"] for k in ["daily_log", "workout_session", "completion",
                                                   "supplement_log", "meal_log", "daily_score"]
                           if len(T[k])])
    d0, d1 = pd.to_datetime(dates_all).min(), pd.to_datetime(dates_all).max()
    for u in users:
        idx = pd.date_range(d0, d1, freq="D")
        f = pd.DataFrame(index=idx)
        f["userId"] = u

        def sub(name):
            df = T[name]
            return df[df.userId == u].copy() if len(df) else df

        comp, supp, meal, dl, ws, wsl, sc = (sub(n) for n in ["completion", "supplement_log",
                                                               "meal_log", "daily_log",
                                                               "workout_session",
                                                               "workout_set_log", "daily_score"])
        # first-log hour and count of logs
        ev = []
        if len(comp): ev.append(pd.DataFrame({"date": comp.date, "h": _hour(comp.completedAt)}))
        if len(supp): ev.append(pd.DataFrame({"date": supp.date, "h": _hour(supp.takenAt)}))
        if len(meal): ev.append(pd.DataFrame({"date": meal.date, "h": _hour(meal.eatenAt)}))
        if len(ws): ev.append(pd.DataFrame({"date": ws.date, "h": _hour(ws.startedAt)}))
        ev = pd.concat(ev) if ev else pd.DataFrame(columns=["date", "h"])
        ev["date"] = pd.to_datetime(ev.date)
        g = ev.groupby("date").h
        f["first_log_h"] = g.min()
        f["n_logs"] = g.size()
        f["n_logs"] = f.n_logs.fillna(0)
        f["opened"] = (f.n_logs > 0).astype(float)
        # AM supplements
        if len(supp):
            s2 = supp.assign(date=pd.to_datetime(supp.date), h=_hour(supp.takenAt))
            if am_supps is not None:
                s2 = s2[s2.supplementId.isin(am_supps)]
            n_am = len(am_supps) if am_supps else 1
            f["am_supp_frac"] = (s2[s2.h < am_cutoff_hour].groupby("date").size() / n_am).clip(upper=1)
        f["am_supp_frac"] = f.get("am_supp_frac", pd.Series(dtype=float)).reindex(idx).fillna(0)
        # daily log / check-in
        if len(dl):
            d2 = dl.assign(date=pd.to_datetime(dl.date)).set_index("date")
            f["checkin"] = 1.0
            f["checkin"] = f.index.isin(d2.index).astype(float)
            f["sleep"] = pd.to_numeric(d2.sleep.astype(str).str.replace(",", "."), errors="coerce").reindex(idx)
            f["steps"] = pd.to_numeric(d2.steps, errors="coerce").reindex(idx)
            f["bw"] = pd.to_numeric(d2.bw, errors="coerce").reindex(idx)
            f["checkin_h"] = _hour(d2.createdAt).reindex(idx)
        else:
            f["checkin"] = 0.0
            f["sleep"] = f["steps"] = f["bw"] = f["checkin_h"] = np.nan
        # nutrition
        ptarget = parse_target(prefs.loc[u, "proteinTarget"]) if "proteinTarget" in prefs else np.nan
        if len(meal):
            m2 = meal.assign(date=pd.to_datetime(meal.date))
            f["protein"] = m2.groupby("date").protein.sum().reindex(idx).fillna(0)
            f["kcal"] = m2.groupby("date").calories.sum().reindex(idx).fillna(0)
        else:
            f["protein"] = f["kcal"] = 0.0
        f["protein_ratio"] = f.protein / ptarget
        kt = prefs.loc[u, "kcalTarget"] if "kcalTarget" in prefs else np.nan
        f["kcal_ratio"] = f.kcal / kt
        # workouts
        if len(ws):
            w2 = ws.assign(date=pd.to_datetime(ws.date))
            f["session"] = f.index.isin(w2.date).astype(float)
            if len(wsl):
                nsets = wsl.groupby("sessionId").size()
                w2["nsets"] = w2.id.map(nsets).fillna(0)
                f["sets"] = w2.groupby("date").nsets.sum().reindex(idx).fillna(0)
            else:
                f["sets"] = 0.0
            f["session_h"] = _hour(w2.set_index("date").startedAt).groupby(level=0).min().reindex(idx)
        else:
            f["session"] = 0.0; f["sets"] = 0.0; f["session_h"] = np.nan
        # score
        if len(sc):
            s3 = sc.assign(date=pd.to_datetime(sc.date)).set_index("date")
            f["score"] = s3.score.reindex(idx)
            f["supp_frac"] = (s3.suppDone / s3.suppTotal.replace(0, np.nan)).reindex(idx)
        else:
            f["score"] = np.nan; f["supp_frac"] = np.nan
        # planned days: owner-declared weekdays (preferred) or DailyLog.day != 'Rest'
        planned = str(prefs.loc[u, "plannedDays"]) if "plannedDays" in prefs else ""
        pdays = {int(x) for x in planned.split(",") if x.strip().isdigit()}
        f["planned"] = f.index.weekday.isin(pdays).astype(float)
        frames.append(f)
    P = pd.concat(frames)
    P.index.name = "date"
    return P.reset_index()


def app_streak(scores: pd.Series, threshold=80) -> pd.Series:
    """End-of-day streak exactly as utils/trends.ts scoreStreak computes it on day d
    (live score of d = final score of d). scores: index = consecutive dates, NaN = no row."""
    vals = scores.to_numpy()
    out = np.zeros(len(vals), int)
    for i in range(len(vals)):
        today_ok = not np.isnan(vals[i]) and vals[i] >= threshold
        start = 0 if today_ok else 1
        streak = 0; last_grace = None
        for k in range(start, min(i, 365) + 1):
            v = vals[i - k]
            if not np.isnan(v) and v >= threshold:
                streak += 1; continue
            if streak > 0 and (last_grace is None or k - last_grace > 7):
                last_grace = k; continue
            break
        out[i] = streak
    return pd.Series(out, index=scores.index)


def add_rolling(P: pd.DataFrame) -> pd.DataFrame:
    """Per-user causal derived features, values as of END of each row's date."""
    out = []
    for u, f in P.groupby("userId", sort=False):
        f = f.sort_values("date").copy()
        fl = f.first_log_h
        base_fl = fl.shift(1).rolling(28, min_periods=7).median()
        f["first_log_dev"] = fl - base_fl
        f["first_log_dev3"] = f.first_log_dev.rolling(3, min_periods=1).mean()
        f["first_log_slope7"] = fl.rolling(7, min_periods=4).apply(
            lambda x: np.polyfit(np.arange(len(x))[~np.isnan(x)], x[~np.isnan(x)], 1)[0]
            if (~np.isnan(x)).sum() >= 3 else np.nan, raw=True)
        # same-weekday baseline (previous 8 same weekdays) removes the weekend shift
        wd = f.date.dt.weekday
        fl_wd_base = fl.groupby(wd).transform(lambda s: s.shift(1).rolling(8, min_periods=3).median())
        f["first_log_dev_wd"] = fl - fl_wd_base
        f["first_log_dev_wd3"] = f.first_log_dev_wd.rolling(3, min_periods=1).mean()
        n_wd_base = f.n_logs.groupby(wd).transform(lambda s: s.shift(1).rolling(8, min_periods=3).median())
        f["n_logs_dev_wd3"] = (f.n_logs - n_wd_base).rolling(3, min_periods=1).mean()
        base_n = f.n_logs.shift(1).rolling(28, min_periods=7).median()
        f["n_logs_ratio3"] = f.n_logs.rolling(3, min_periods=1).mean() / base_n.replace(0, np.nan)
        f["n_logs_yday"] = f.n_logs
        f["am_supp_miss3"] = 1 - f.am_supp_frac.rolling(3, min_periods=1).mean()
        f["checkin_skip3"] = 1 - f.checkin.rolling(3, min_periods=1).mean()
        f["opened_gap"] = _days_since(f.opened.to_numpy() > 0)
        f["sleep_last"] = f.sleep.ffill(limit=3)
        f["sleep_mean3"] = f.sleep.rolling(3, min_periods=1).mean()
        f["sleep_dev3"] = f.sleep_mean3 - f.sleep.shift(1).rolling(28, min_periods=5).mean()
        f["steps_dev3"] = (f.steps.rolling(3, min_periods=1).mean()
                           - f.steps.shift(1).rolling(28, min_periods=5).mean())
        defic = ((f.protein_ratio < 0.8) | f.protein_ratio.isna()).to_numpy()
        f["protein_def_streak"] = _run_length(defic)
        f["protein_ratio3"] = f.protein_ratio.rolling(3, min_periods=1).mean()
        f["kcal_over_yday"] = (f.kcal_ratio > 1.15).astype(float)
        f["score_last"] = f.score
        f["score_mean3"] = f.score.rolling(3, min_periods=1).mean()
        f["score_dev3"] = f.score_mean3 - f.score.shift(1).rolling(28, min_periods=7).mean()
        f["days_since_session"] = _days_since(f.session.to_numpy() > 0)
        pl = f.planned.to_numpy() > 0
        miss = pl & (f.session.to_numpy() == 0)
        last_pl_missed = np.full(len(f), np.nan); cur = np.nan
        for i in range(len(f)):
            if pl[i]: cur = float(miss[i])
            last_pl_missed[i] = cur
        f["missed_last_planned"] = last_pl_missed
        mp = pd.Series(np.where(pl, miss.astype(float), np.nan), index=f.index)
        f["miss_rate14"] = mp.rolling(14, min_periods=1).mean()
        f["partial_last"] = (f.sets.where(f.session > 0).ffill() <
                             f.sets.where(f.session > 0).rolling(28, min_periods=1).max().ffill()).astype(float)
        f["session_h_dev"] = f.session_h.ffill() - f.session_h.shift(1).rolling(28, min_periods=3).median().ffill()
        f["streak"] = app_streak(f.set_index("date").score).to_numpy()
        out.append(f)
    return pd.concat(out)


def _days_since(flag: np.ndarray) -> np.ndarray:
    out = np.full(len(flag), np.nan); last = None
    for i, x in enumerate(flag):
        if x: last = i
        out[i] = (i - last) if last is not None else np.nan
    return out


def _run_length(flag: np.ndarray) -> np.ndarray:
    out = np.zeros(len(flag)); r = 0
    for i, x in enumerate(flag):
        r = r + 1 if x else 0
        out[i] = r
    return out


FEATURES = ["first_log_dev", "first_log_dev3", "first_log_slope7", "first_log_dev_wd",
            "first_log_dev_wd3", "n_logs_dev_wd3", "n_logs_yday", "n_logs_ratio3",
            "am_supp_miss3", "checkin_skip3", "opened_gap", "sleep_last", "sleep_mean3",
            "sleep_dev3", "steps_dev3", "protein_def_streak", "protein_ratio3", "kcal_over_yday",
            "score_last", "score_mean3", "score_dev3", "days_since_session",
            "missed_last_planned", "miss_rate14", "partial_last", "session_h_dev", "streak"]


def lead_dataset(P: pd.DataFrame, lead: int, target: str) -> pd.DataFrame:
    """Rows = target days t. Features shifted from t-lead. target in {'miss','streak_break'}."""
    rows = []
    for u, f in P.groupby("userId", sort=False):
        f = f.sort_values("date").reset_index(drop=True)
        X = f[FEATURES].shift(lead)
        d = pd.DataFrame({"userId": u, "date": f.date, "dow": f.date.dt.weekday,
                          "planned": f.planned, "month_start": (f.date.dt.day <= 3).astype(float)})
        d = pd.concat([d, X], axis=1)
        if target == "miss":
            d["y"] = ((f.planned > 0) & (f.session == 0)).astype(int)
            d = d[f.planned > 0]
        else:  # streak alive at end of t-1 and dead at end of t
            prev = f.streak.shift(1)
            d["y"] = ((prev > 0) & (f.streak == 0)).astype(int)
            # only days where a streak is alive at prediction time t-lead
            d = d[(f.streak.shift(lead) > 0).to_numpy()]
        rows.append(d)
    D = pd.concat(rows, ignore_index=True)
    return D.dropna(subset=["days_since_session"]).reset_index(drop=True)
