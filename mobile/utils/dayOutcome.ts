// Glue between the app's day data and the pure Outcome Score contract
// (utils/outcomeScore.ts). Client-side for instant/offline display; the server
// will become authoritative.

import {
  computeOutcomeScore,
  type DayOutcome,
  type OutcomeInput,
  type OutcomeResult,
} from "./outcomeScore";

export type DayPlan = "train" | "rest";

export type TodayOutcomeArgs = {
  plan: DayPlan | null; // null = no program selected → training unknown
  setsDone: number;
  setsPlanned: number;
  consumed: { protein: number; calories: number } | null; // null = nothing logged
  proteinTarget: number;
  calorieTarget: number;
  bwSlope: number | null;
  goalRate: number | null;
};

export function buildTodayOutcomeInput(a: TodayOutcomeArgs): OutcomeInput {
  return {
    plan: a.plan === "rest" ? "rest" : "train",
    setsDone: a.setsDone,
    setsPlanned: a.plan === null ? 0 : a.setsPlanned,
    protein: a.consumed ? a.consumed.protein : null,
    proteinTarget: a.proteinTarget || null,
    calories: a.consumed ? a.consumed.calories : null,
    calorieTarget: a.calorieTarget || null,
    bwSlope: a.bwSlope,
    goalRate: a.goalRate,
  };
}

// Σ planned working sets for a program day ("3", "3-4" → 3; blank → 3).
export function plannedSetCount(rows: Array<{ sets: string }>): number {
  return rows.reduce((total, row) => {
    const match = String(row.sets || "").match(/\d+/);
    const n = match ? Number(match[0]) : 3;
    return total + (n > 0 ? n : 3);
  }, 0);
}

export function computeTodayOutcome(a: TodayOutcomeArgs): OutcomeResult {
  return computeOutcomeScore(buildTodayOutcomeInput(a));
}

// Past days from DailyScore snapshots (score, workoutDone, protein, calories).
// A day with no protein and no calories logged is unscored.
export type ScoreSnapshotRow = {
  date: string;
  workoutDone: boolean;
  protein: number;
  calories: number;
};

export function dayOutcomesFromSnapshots(
  rows: ScoreSnapshotRow[],
  opts: {
    proteinTarget: number;
    calorieTarget: number;
    planFor: (date: string) => DayPlan | null;
  }
): DayOutcome[] {
  return rows.map((row) => {
    const nothingLogged = !(row.protein > 0) && !(row.calories > 0);
    if (nothingLogged) return { date: row.date, score: null, kept: false };
    const plan = opts.planFor(row.date);
    const result = computeOutcomeScore({
      plan: plan === "rest" ? "rest" : "train",
      // Snapshots only know done / not done; a done workout met ≥ 80% of sets
      setsDone: row.workoutDone ? 1 : 0,
      setsPlanned: plan === null ? 0 : 1,
      protein: row.protein,
      proteinTarget: opts.proteinTarget || null,
      calories: row.calories > 0 ? row.calories : null,
      calorieTarget: opts.calorieTarget || null,
    });
    return { date: row.date, score: result.score, kept: result.kept };
  });
}
