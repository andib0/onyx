"""Reference implementation of the Outcome Score (docs/audit/04 §A4).

This is the oracle: backend and mobile implementations must reproduce
score-vectors.json exactly. Regenerate vectors with:
    python contracts/outcome_score_reference.py > contracts/score-vectors.json
"""
import json
import math

W = {"T": 0.40, "Pr": 0.30, "Ca": 0.20, "Bw": 0.10}


def components(d):
    c = {}
    if d["plan"] == "rest":
        c["T"] = 1.0
    elif d.get("setsPlanned"):
        c["T"] = min(1.0, d["setsDone"] / (0.8 * d["setsPlanned"]))
    else:
        c["T"] = None
    c["Pr"] = None if d.get("protein") is None or not d.get("proteinTarget") else min(1.0, d["protein"] / d["proteinTarget"])
    if d.get("calories") is None or not d.get("calorieTarget"):
        c["Ca"] = None
    else:
        dev = abs(d["calories"] / d["calorieTarget"] - 1)
        c["Ca"] = 1.0 if dev <= 0.05 else max(0.0, 1 - (dev - 0.05) / 0.15)
    if d.get("bwSlope") is None or d.get("goalRate") is None:
        c["Bw"] = None
    else:
        c["Bw"] = max(0.0, 1 - abs(d["bwSlope"] - d["goalRate"]) / 0.5)
    return c


def score(d):
    c = components(d)
    if c["Pr"] is None and c["Ca"] is None:
        return {"score": None, "kept": False, "components": c}
    known = {k: v for k, v in c.items() if v is not None}
    s = 100 * sum(W[k] * v for k, v in known.items()) / sum(W[k] for k in known)
    kept = (c["T"] is not None and c["T"] >= 1) and (c["Pr"] is not None and c["Pr"] >= 0.85)
    return {"score": math.floor(s + 0.5), "kept": kept, "components": {k: (None if v is None else round(v, 4)) for k, v in c.items()}}


BASE = {"plan": "train", "setsDone": 15, "setsPlanned": 15, "protein": 160, "proteinTarget": 160,
        "calories": 2500, "calorieTarget": 2500, "bwSlope": -0.4, "goalRate": -0.4}

CASES = [
    ("perfect training day", {}),
    ("perfect planned rest day", {"plan": "rest", "setsDone": 0}),
    ("skipped session, protein 50%", {"setsDone": 0, "protein": 80}),
    ("80% of sets counts as full training", {"setsDone": 12}),
    ("half the sets", {"setsDone": 6}),
    ("protein 85% is still kept", {"protein": 136}),
    ("protein 84% breaks kept", {"protein": 134}),
    ("calories +5% full credit", {"calories": 2625}),
    ("calories +20% zero credit", {"calories": 3000}),
    ("calories -12.5% half credit", {"calories": 2187.5}),
    ("nothing logged to eat -> unscored", {"protein": None, "calories": None}),
    ("no weight trend yet -> Bw dropped from weights", {"bwSlope": None}),
    ("bodyweight off goal by 0.25 kg/wk", {"bwSlope": -0.15}),
    ("train day with no plan sets -> T unknown", {"setsPlanned": 0, "setsDone": 0}),
]

if __name__ == "__main__":
    out = []
    for name, patch in CASES:
        d = dict(BASE); d.update(patch)
        out.append({"name": name, "input": d, "expected": score(d)})
    print(json.dumps({"weights": W, "vectors": out}, indent=2))
