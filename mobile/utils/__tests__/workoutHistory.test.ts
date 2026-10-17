import { describe, expect, it } from "vitest";
import {
  CANONICAL_EXERCISES,
  aliasQueryNames,
  buildExerciseTimeline,
  mergeHistoryByCanonical,
} from "../workoutHistory";

const set = (
  exerciseName: string,
  setNumber: number,
  weightKg: number,
  reps: number
) => ({
  exerciseName,
  setNumber,
  weightKg,
  reps,
  rir: null,
});

describe("aliasQueryNames", () => {
  it("asks for every known spelling of a lift", () => {
    const names = aliasQueryNames(["Barbell Bench Press"]);
    expect(names).toContain("Barbell Bench Press");
    expect(names).toContain("Bench Press");
    expect(names).toContain("Flat Barbell Bench Press");
  });
  it("passes unknown names through", () => {
    expect(aliasQueryNames(["Zercher Carry"])).toEqual(["Zercher Carry"]);
  });
});

describe("mergeHistoryByCanonical (migrate on read)", () => {
  it("folds legacy spellings onto the canonical name, newest wins", () => {
    const merged = mergeHistoryByCanonical({
      "Bench Press": { sessionId: "a", date: "2026-09-01", sets: [] },
      "Barbell Bench Press": { sessionId: "b", date: "2026-10-01", sets: [] },
      "Barbell Rows": { sessionId: "c", date: "2026-09-15", sets: [] },
    });
    expect(Object.keys(merged).sort()).toEqual(["Barbell Bench Press", "Barbell Row"]);
    expect(merged["Barbell Bench Press"].sessionId).toBe("b");
    expect(mergeHistoryByCanonical(null)).toEqual({});
  });
});

describe("buildExerciseTimeline", () => {
  const sessions = [
    // API returns newest first
    {
      id: "s3",
      date: "2026-10-10",
      sets: [set("Barbell Bench Press", 1, 102.5, 5)],
    },
    {
      id: "s2",
      date: "2026-10-07",
      sets: [set("Bench Press", 2, 100, 5), set("Bench Press", 1, 100, 6)],
    },
    { id: "s1", date: "2026-10-03", sets: [set("Squats", 1, 140, 5)] },
    { id: "live", date: "2026-10-12", sets: [set("Bench Press", 1, 60, 10)] },
  ];

  it("orders sessions oldest → newest per canonical lift, excluding the live one", () => {
    const t = buildExerciseTimeline(sessions, "live");
    expect(t.sessions["Barbell Bench Press"].map((s) => s.date)).toEqual([
      "2026-10-07",
      "2026-10-10",
    ]);
    expect(t.sessions["Barbell Bench Press"][0].sets.map((s) => s.reps)).toEqual([6, 5]);
    expect(t.last["Barbell Bench Press"].sessionId).toBe("s3");
    expect(t.last["Back Squat"].sessionId).toBe("s1");
    expect(t.allSets["Barbell Bench Press"]).toHaveLength(3);
  });

  it("exposes canonical names", () => {
    expect(CANONICAL_EXERCISES).toContain("Barbell Bench Press");
  });
});
