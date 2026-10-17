// Outcome Score + streak — client implementation of contracts/README.md
// (oracle: contracts/outcome_score_reference.py, vectors: contracts/score-vectors.json).
// The server computes the authoritative value; this one exists for instant /
// offline display and must reproduce the shared vectors exactly.

export type OutcomeInput = {
  plan: "train" | "rest";
  setsDone?: number | null;
  setsPlanned?: number | null;
  protein?: number | null;
  proteinTarget?: number | null;
  calories?: number | null;
  calorieTarget?: number | null;
  bwSlope?: number | null; // kg/week, OLS over the last 14 weigh-ins
  goalRate?: number | null; // kg/week the goal asks for
};

export type OutcomeComponents = {
  T: number | null;
  Pr: number | null;
  Ca: number | null;
  Bw: number | null;
};

export type OutcomeResult = {
  score: number | null; // null = unscored (nothing eaten was logged)
  kept: boolean;
  components: OutcomeComponents;
};

export const OUTCOME_WEIGHTS = { T: 0.4, Pr: 0.3, Ca: 0.2, Bw: 0.1 } as const;

const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);
// Python truthiness of the reference: None and 0 are both "not set".
const truthy = (v: number | null | undefined): v is number => isNum(v) && v !== 0;

export function outcomeComponents(d: OutcomeInput): OutcomeComponents {
  let T: number | null;
  if (d.plan === "rest") T = 1;
  else if (truthy(d.setsPlanned))
    T = Math.min(1, (d.setsDone ?? 0) / (0.8 * d.setsPlanned));
  else T = null;

  const Pr =
    !isNum(d.protein) || !truthy(d.proteinTarget)
      ? null
      : Math.min(1, d.protein / d.proteinTarget);

  let Ca: number | null = null;
  if (isNum(d.calories) && truthy(d.calorieTarget)) {
    const dev = Math.abs(d.calories / d.calorieTarget - 1);
    Ca = dev <= 0.05 ? 1 : Math.max(0, 1 - (dev - 0.05) / 0.15);
  }

  const Bw =
    !isNum(d.bwSlope) || !isNum(d.goalRate)
      ? null
      : Math.max(0, 1 - Math.abs(d.bwSlope - d.goalRate) / 0.5);

  return { T, Pr, Ca, Bw };
}

const round4 = (v: number | null) => (v === null ? null : Math.round(v * 1e4) / 1e4);

export function computeOutcomeScore(d: OutcomeInput): OutcomeResult {
  const c = outcomeComponents(d);
  if (c.Pr === null && c.Ca === null) {
    return { score: null, kept: false, components: c };
  }
  let num = 0;
  let den = 0;
  for (const key of ["T", "Pr", "Ca", "Bw"] as const) {
    const v = c[key];
    if (v === null) continue;
    num += OUTCOME_WEIGHTS[key] * v;
    den += OUTCOME_WEIGHTS[key];
  }
  const kept = c.T !== null && c.T >= 1 && c.Pr !== null && c.Pr >= 0.85;
  return {
    score: Math.floor((100 * num) / den + 0.5),
    kept,
    components: { T: round4(c.T), Pr: round4(c.Pr), Ca: round4(c.Ca), Bw: round4(c.Bw) },
  };
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

export type DayOutcome = { date: string; score: number | null; kept: boolean };

export type StreakResult = {
  count: number;
  // kept: today already kept (counted) · pending: today not kept yet, showing the
  // streak through yesterday · none: nothing to show
  state: "kept" | "pending" | "none";
  graceUsedThisWeek: boolean;
};

// Pure calendar arithmetic on "YYYY-MM-DD" keys (UTC-anchored → no DST drift).
function keyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysKey(key: string, days: number): string {
  return utcToKey(keyToUtc(key) + days * 86400000);
}

// ISO week identity = the Monday that starts it.
export function isoWeekKey(key: string): string {
  const ms = keyToUtc(key);
  const weekday = (new Date(ms).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return utcToKey(ms - weekday * 86400000);
}

// Streak = consecutive kept days ending yesterday (+ today if already kept).
// One grace day per ISO week: the first scored-but-not-kept day of a week
// neither breaks nor extends the streak; a second one breaks it. Unscored days
// (nothing logged, or no row) are not kept and are not grace-eligible.
// Today is never a break — it's "pending" until it's kept.
export function computeStreak(history: DayOutcome[], todayKey: string): StreakResult {
  const byDate = new Map<string, DayOutcome>();
  let earliest = todayKey;
  for (const row of history) {
    if (row.date > todayKey) continue;
    byDate.set(row.date, row);
    if (row.date < earliest) earliest = row.date;
  }

  const graceWeeks = new Set<string>();
  let count = 0;
  let date = addDaysKey(todayKey, -1);
  while (date >= earliest) {
    const row = byDate.get(date);
    if (row && row.kept) {
      count++;
    } else if (row && row.score !== null && !graceWeeks.has(isoWeekKey(date))) {
      graceWeeks.add(isoWeekKey(date));
    } else {
      break;
    }
    date = addDaysKey(date, -1);
  }

  const today = byDate.get(todayKey);
  const graceUsedThisWeek = graceWeeks.has(isoWeekKey(todayKey));
  if (today && today.kept) return { count: count + 1, state: "kept", graceUsedThisWeek };
  return { count, state: count > 0 ? "pending" : "none", graceUsedThisWeek };
}
