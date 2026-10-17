"""Simulation-only diagnostics (needs _truth.csv and _panel.csv from analyze.py).

1. Label noise: planned days trained but not logged as a WorkoutSession.
2. Ceiling: AUC of the TRUE same-day latent state for the observed miss label.
3. Score validity on simulated days: how often a >=80 day was a bad day.
4. Streak-break anatomy: weekday distribution; share caused by 2 consecutive <80 days.
5. Proposed outcome score vs app score: correlation with true outcomes.

Usage: python diagnostics.py --data sim_out
"""
import argparse
import os

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

ap = argparse.ArgumentParser()
ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "sim_out"))
a = ap.parse_args()
tr = pd.read_csv(os.path.join(a.data, "_truth.csv"), parse_dates=["date"])
P = pd.read_csv(os.path.join(a.data, "_panel.csv"), parse_dates=["date"])
prefs = pd.read_csv(os.path.join(a.data, "user_preferences.csv")).set_index("userId")
M = P.merge(tr, on=["userId", "date"], how="left", suffixes=("", "_t"))
pl = M[M.planned_t]
obs_miss = (pl.session == 0).astype(int)
true_miss = (~pl.trained).astype(int)
print("1. planned days:", len(pl), " true miss rate %.3f  observed miss rate %.3f" %
      (true_miss.mean(), obs_miss.mean()))
print("   trained-but-unlogged share of observed misses: %.3f" %
      (((obs_miss == 1) & (true_miss == 0)).sum() / max(1, obs_miss.sum())))

split = M.date.min() + (M.date.max() - M.date.min()) * 0.5
X = pd.DataFrame({"stress": pl.stress, "mot": pl.motivation, "ill": pl.illness.astype(float),
                  "trav": pl.travel.astype(float), "debt": np.maximum(0, 7 - pl.sleep_true),
                  "wkend": (pl.date.dt.weekday >= 5).astype(float)})
t = (pl.date < split).to_numpy()
clf = LogisticRegression(max_iter=1000).fit(X[t], obs_miss[t])
print("2. ceiling AUC (true same-day latent -> observed miss, test half): %.3f" %
      roc_auc_score(obs_miss[~t], clf.predict_proba(X[~t])[:, 1]))
clf2 = LogisticRegression(max_iter=1000).fit(X[t], true_miss[t])
print("   ceiling AUC vs TRUE miss: %.3f" % roc_auc_score(true_miss[~t], clf2.predict_proba(X[~t])[:, 1]))

S = M[M.score.notna()].copy()
S["ptgt"] = S.userId.map(lambda u: float(str(prefs.loc[u, "proteinTarget"]).split()[0]))
S["prot_ok"] = S.protein_true >= 0.9 * S.ptgt
hi = S[S.score >= 80]
bad = hi[(hi.planned_t & ~hi.trained) | ~hi.prot_ok]
print("3. days scored >=80: %d; of those, planned-session missed: %.1f%%; true protein <90%% target: %.1f%%;"
      " either: %.1f%%" % (len(hi), 100 * (hi.planned_t & ~hi.trained).mean(),
                          100 * (~hi.prot_ok).mean(), 100 * len(bad) / len(hi)))
lo = S[S.score < 80]
good = lo[((lo.planned_t & lo.trained) | ~lo.planned_t) & lo.prot_ok]
print("   days scored <80 that were on-plan for training AND protein: %.1f%% of %d" %
      (100 * len(good) / len(lo), len(lo)))
rest = S[~S.planned_t]
print("   planned-rest days: mean app score %.1f vs training days that trained %.1f" %
      (rest.score.mean(), S[S.planned_t & S.trained].score.mean()))

# 4. streak-break anatomy
brk = []
for u, f in M.groupby("userId"):
    f = f.sort_values("date").reset_index(drop=True)
    b = (f.streak.shift(1) > 0) & (f.streak == 0)
    sub = f[b].copy()
    sub["prev_lt80"] = (f.score.shift(1)[b] < 80) | f.score.shift(1)[b].isna()
    sub["today_lt80"] = (f.score[b] < 80) | f.score[b].isna()
    brk.append(sub)
B = pd.concat(brk)
print("4. streak breaks: %d; both today & yesterday <80 (or no row): %.1f%%" %
      (len(B), 100 * (B.prev_lt80 & B.today_lt80).mean()))
print("   breaks by weekday (Mon=0):", B.date.dt.weekday.value_counts().sort_index().to_dict())
print("   no-row (app not opened) on break day: %.1f%%" % (100 * B.score.isna().mean()))

# 5. proposed outcome score vs app score
S["train_adh"] = np.where(S.planned_t, (S.session > 0).astype(float), 1.0)
S["prot_adh"] = np.clip(S.protein / S.ptgt, 0, 1)
kt = S.userId.map(prefs.kcalTarget)
S["kcal_adh"] = np.clip(1 - np.abs(S.kcal / kt - 1) / 0.25, 0, 1)
S["outcome_score"] = 100 * (0.45 * S.train_adh + 0.30 * S.prot_adh + 0.25 * S.kcal_adh)
S["true_quality"] = (0.45 * np.where(S.planned_t, S.trained.astype(float), 1.0)
                     + 0.30 * np.clip(S.protein_true / S.ptgt, 0, 1)
                     + 0.25 * np.clip(1 - np.abs(S.kcal_true / kt - 1) / 0.25, 0, 1))
print("5. Spearman with TRUE day quality (training-vs-plan, protein, kcal):")
print("   app score     : %.3f" % S[["score", "true_quality"]].corr("spearman").iloc[0, 1])
print("   outcome score : %.3f" % S[["outcome_score", "true_quality"]].corr("spearman").iloc[0, 1])
