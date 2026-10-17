# Contracts

Shared specs that both `backend/` and `mobile/` implement. Each has a reference
implementation (the oracle) and JSON vectors; both packages' tests load the vectors and must
match them exactly. Change the reference first, regenerate the vectors, then both packages.

## Outcome Score (`outcome_score_reference.py` → `score-vectors.json`)

Source: `docs/audit/04-score-and-prediction.md` §A4.

- Components, each 0..1 or unknown:
  - `T`  = rest day ? 1 : min(1, setsDone / (0.8 · setsPlanned)); unknown if no planned sets.
  - `Pr` = min(1, protein / proteinTarget); unknown if nothing logged.
  - `Ca` = 1 within ±5% of calorieTarget, linear to 0 at ±20%; unknown if nothing logged.
  - `Bw` = max(0, 1 − |bwSlope − goalRate| / 0.5) (kg/week, OLS over last 14 weigh-ins).
- Score = floor(100 · Σ wᵢcᵢ / Σ wᵢ + 0.5) over known components; weights T .40, Pr .30, Ca .20, Bw .10.
- Unscored (null) when both Pr and Ca are unknown.
- **Kept day** = T ≥ 1 AND Pr ≥ 0.85.

## Streak

- Streak = consecutive kept days ending yesterday, plus today if already kept.
- One grace day per ISO week (Mon–Sun): the first non-kept, non-unscored day in a week does
  not break the streak (it does not add to it either). A second one in the same week breaks it.
- Unscored days (nothing logged) are treated as not kept.
- Display never shows 0 for "today pending": if yesterday's streak is n > 0 and today is not
  yet kept, show n with state `pending`.
- Days are local dates in `UserPreferences.timezone`.
