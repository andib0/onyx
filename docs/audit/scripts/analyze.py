"""Task B analysis: time-split evaluation of leading signals for a missed planned
training day and for a broken app streak.

Usage:
  python analyze.py --data sim_out [--split-date 2025-10-06] [--truth]
On real data: point --data at the export dir (see report for SQL), and pass
--split-date at roughly 60% of the history. --truth only works on simulated data.
"""
from __future__ import annotations

import argparse
import json
import os
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from features import FEATURES, add_rolling, daily_panel, lead_dataset, load

warnings.filterwarnings("ignore")
LEADS = [1, 2, 3, 5, 7]


def prec_at(y, p, frac=0.10):
    k = max(1, int(round(len(y) * frac)))
    order = np.argsort(-p)[:k]
    return float(np.mean(np.asarray(y)[order]))


def design(D, feats, train_mask, user_rate=None):
    X = pd.get_dummies(D.dow.astype(int), prefix="dow").astype(float)
    if user_rate is not None:
        X["user_rate"] = D.userId.map(user_rate).fillna(np.nanmean(list(user_rate.values)))
    for c in feats:
        med = D.loc[train_mask, c].median()
        X[c] = D[c].fillna(med if pd.notna(med) else 0)
        X[c + "_na"] = D[c].isna().astype(float)
    X = X.loc[:, X.std() > 0]
    return X


def cluster_boot_auc(y, p, users, n=300, seed=0):
    rng = np.random.default_rng(seed)
    uu = np.unique(users); aucs = []
    y = np.asarray(y); p = np.asarray(p); users = np.asarray(users)
    idx_by_u = {u: np.where(users == u)[0] for u in uu}
    for _ in range(n):
        pick = rng.choice(uu, len(uu), replace=True)
        ix = np.concatenate([idx_by_u[u] for u in pick])
        if len(np.unique(y[ix])) < 2: continue
        aucs.append(roc_auc_score(y[ix], p[ix]))
    return np.percentile(aucs, [2.5, 97.5]).round(3).tolist()


def evaluate(D, split, label):
    tr = (D.date < split).to_numpy(); te = ~tr
    y = D.y.to_numpy()
    user_rate = D[tr].groupby("userId").y.mean()
    res = {}

    def fit_eval(name, feats, use_user=False, model="lr"):
        X = design(D, feats, tr, user_rate if use_user else None)
        if model == "lr":
            clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5))
        else:
            clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                                 l2_regularization=1.0, random_state=0)
        clf.fit(X[tr], y[tr])
        p = clf.predict_proba(X[te])[:, 1]
        res[name] = dict(auc=round(roc_auc_score(y[te], p), 3),
                         ap=round(average_precision_score(y[te], p), 3),
                         p_at_10=round(prec_at(y[te], p), 3),
                         base_rate=round(float(y[te].mean()), 3),
                         auc_ci=cluster_boot_auc(y[te], p, D.userId[te]))
        return p

    fit_eval("B0_dow_only", [])
    fit_eval("B1_dow+user_rate", [], use_user=True)
    fit_eval("B2_dow+user+recency", ["missed_last_planned", "days_since_session", "miss_rate14"],
             use_user=True)
    fit_eval("M_all_logistic", FEATURES, use_user=True)
    fit_eval("M_all_gbm", FEATURES, use_user=True, model="gbm")
    # single-feature incremental value over B1 (who + weekday)
    single = {}
    b1_auc = res["B1_dow+user_rate"]["auc"]
    for c in FEATURES:
        Xc = D[[c]].copy()
        med = Xc[tr][c].median()
        v = Xc[c].fillna(med if pd.notna(med) else 0).to_numpy()
        if np.nanstd(v[tr]) == 0 or len(np.unique(y[te])) < 2:
            continue
        a = roc_auc_score(y[te], v[te])
        a_tr = roc_auc_score(y[tr], v[tr])
        oriented = a if a_tr >= 0.5 else 1 - a  # direction chosen on TRAIN only
        X = design(D, [c], tr, user_rate)
        clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5))
        clf.fit(X[tr], y[tr]); p = clf.predict_proba(X[te])[:, 1]
        # per-user consistency on test
        per_u = []
        for u, g in D[te].groupby("userId"):
            yy = g.y.to_numpy(); vv = g[c].fillna(med if pd.notna(med) else 0).to_numpy()
            if len(np.unique(yy)) == 2 and np.std(vv) > 0:
                au = roc_auc_score(yy, vv); per_u.append(au if a_tr >= 0.5 else 1 - au)
        single[c] = dict(auc_alone=round(oriented, 3),
                         auc_with_B1=round(roc_auc_score(y[te], p), 3),
                         delta_vs_B1=round(roc_auc_score(y[te], p) - b1_auc, 3),
                         users_auc_gt_055=f"{sum(x > 0.55 for x in per_u)}/{len(per_u)}",
                         direction="+" if a_tr >= 0.5 else "-")
    res["single"] = single
    res["n_train"], res["n_test"] = int(tr.sum()), int(te.sum())
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "sim_out"))
    ap.add_argument("--split-date", default=None)
    ap.add_argument("--am-supps", default="creatine,vitd3,omega3")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "results.json"))
    a = ap.parse_args()
    T = load(a.data)
    P = daily_panel(T, am_supps=set(a.am_supps.split(",")) if a.am_supps else None)
    P = add_rolling(P)
    P.to_csv(os.path.join(a.data, "_panel.csv"), index=False)
    split = pd.Timestamp(a.split_date) if a.split_date else P.date.min() + (P.date.max() - P.date.min()) * 0.5
    print("split date:", split.date())
    allres = {}
    for target in ["miss", "streak_break"]:
        for L in LEADS:
            D = lead_dataset(P, L, target)
            r = evaluate(D, split, f"{target}@{L}")
            allres[f"{target}@lead{L}"] = r
            top = sorted(r["single"].items(), key=lambda kv: -kv[1]["delta_vs_B1"])[:6]
            print(f"\n== {target} lead={L}d  train={r['n_train']} test={r['n_test']} "
                  f"base={r['B0_dow_only']['base_rate']}")
            for k in ["B0_dow_only", "B1_dow+user_rate", "B2_dow+user+recency", "M_all_logistic", "M_all_gbm"]:
                print(f"   {k:<24} AUC={r[k]['auc']} CI={r[k]['auc_ci']} AP={r[k]['ap']} P@10%={r[k]['p_at_10']}")
            for c, s in top:
                print(f"   + {c:<20} alone={s['auc_alone']} withB1={s['auc_with_B1']} "
                      f"d={s['delta_vs_B1']:+.3f} users>0.55={s['users_auc_gt_055']} dir={s['direction']}")
    with open(a.out, "w") as fh:
        json.dump(allres, fh, indent=1, default=str)
    print("\nwrote", a.out)


if __name__ == "__main__":
    main()
