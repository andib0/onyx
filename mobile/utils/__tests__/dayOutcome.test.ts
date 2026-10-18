import { describe, expect, it } from "vitest";
import {
  buildTodayOutcomeInput,
  computeTodayOutcome,
  dayOutcomesFromSnapshots,
  plannedSetCount,
} from "../dayOutcome";

const base = {
  plan: "train" as const,
  setsDone: 0,
  setsPlanned: 15,
  consumed: { protein: 160, calories: 2500 },
  proteinTarget: 160,
  calorieTarget: 2500,
  bwSlope: null,
  goalRate: 0,
};

describe("plannedSetCount", () => {
  it("sums the leading number of each sets string, defaulting to 3", () => {
    expect(plannedSetCount([{ sets: "3" }, { sets: "4-5" }, { sets: "" }])).toBe(10);
    expect(plannedSetCount([])).toBe(0);
  });
});

describe("computeTodayOutcome", () => {
  it("no program selected → training unknown, score from nutrition only", () => {
    const input = buildTodayOutcomeInput(Object.assign({}, base, { plan: null }));
    expect(input.setsPlanned).toBe(0);
    const out = computeTodayOutcome(Object.assign({}, base, { plan: null }));
    expect(out.components.T).toBeNull();
    expect(out.score).toBe(100);
    expect(out.kept).toBe(false); // kept requires training per plan
  });

  it("nothing logged to eat → unscored (never a misleading 0)", () => {
    const out = computeTodayOutcome(Object.assign({}, base, { consumed: null }));
    expect(out.score).toBeNull();
  });

  it("12 of 15 sets (80%) + protein met → kept", () => {
    const out = computeTodayOutcome(Object.assign({}, base, { setsDone: 12 }));
    expect(out.kept).toBe(true);
    expect(out.score).toBe(100);
  });

  it("Mark done with no sets logged counts as the planned training (contract)", () => {
    const out = computeTodayOutcome(Object.assign({}, base, { markedDone: true }));
    expect(out.components.T).toBe(1);
    expect(out.kept).toBe(true);
    const unplanned = computeTodayOutcome(
      Object.assign({}, base, { plan: null, markedDone: true })
    );
    expect(unplanned.components.T).toBe(1);
  });

  it("zero targets are unknown, not divide-by-zero", () => {
    const out = computeTodayOutcome(
      Object.assign({}, base, { proteinTarget: 0, calorieTarget: 0 })
    );
    expect(out.score).toBeNull();
  });
});

describe("dayOutcomesFromSnapshots", () => {
  const opts = {
    proteinTarget: 160,
    calorieTarget: 2500,
    planFor: () => "train" as const,
  };
  it("maps snapshots to kept / missed / unscored", () => {
    const out = dayOutcomesFromSnapshots(
      [
        { date: "2026-10-10", workoutDone: true, protein: 150, calories: 2400 },
        { date: "2026-10-11", workoutDone: false, protein: 150, calories: 2400 },
        { date: "2026-10-12", workoutDone: false, protein: 0, calories: 0 },
      ],
      opts
    );
    expect(out[0]).toMatchObject({ kept: true });
    expect(out[1]).toMatchObject({ kept: false });
    expect(out[1].score).not.toBeNull();
    expect(out[2]).toEqual({ date: "2026-10-12", score: null, kept: false });
  });

  it("a planned rest day with protein met is kept without a workout", () => {
    const out = dayOutcomesFromSnapshots(
      [{ date: "2026-10-11", workoutDone: false, protein: 140, calories: 0 }],
      Object.assign({}, opts, { planFor: () => "rest" as const })
    );
    expect(out[0].kept).toBe(true);
  });
});
