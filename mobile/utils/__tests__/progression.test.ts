import { describe, expect, it } from "vitest";
import {
  detectStall,
  incrementFromText,
  isCompound,
  nextLoadKg,
  parseRepRange,
  parseRepTarget,
  roundToLoadable,
  suggestNext,
  suggestProgression,
  usesPlates,
  type SessionLog,
} from "../progression";

const session = (weightKg: number, reps: number[]): SessionLog => ({
  sets: reps.map((r) => ({ weightKg, reps: r })),
});

describe("parseRepRange (legacy)", () => {
  it("parses a range and a single number", () => {
    expect(parseRepRange("8-12")).toEqual({ low: 8, high: 12 });
    expect(parseRepRange("5")).toEqual({ low: 5, high: 5 });
    expect(parseRepRange("")).toEqual({ low: 8, high: 8 });
  });
});

describe("parseRepTarget (audit 05 #15)", () => {
  it.each([
    ["6-10", { kind: "reps", low: 6, high: 10 }],
    ["5", { kind: "reps", low: 5, high: 5 }],
    ["12 each", { kind: "reps", low: 12, high: 12 }],
    ["AMRAP", { kind: "amrap" }],
    ["to failure", { kind: "amrap" }],
    ["30-60s", { kind: "time", lowSec: 30, highSec: 60 }],
    ["45 sec", { kind: "time", lowSec: 45, highSec: 45 }],
    ["1-2 min", { kind: "time", lowSec: 60, highSec: 120 }],
  ])("%s", (input, expected) => {
    expect(parseRepTarget(input)).toEqual(expected);
  });
});

describe("equipment-aware loading (audit 05 #8)", () => {
  it("plate math only for barbell lifts", () => {
    expect(usesPlates("Bench Press")).toBe(true);
    expect(usesPlates("Barbell Squats")).toBe(true);
    // The old regex treated these as compounds → "DB bench 30 kg → 5 per side"
    expect(isCompound("Dumbbell Bench Press")).toBe(true);
    expect(usesPlates("Dumbbell Bench Press")).toBe(false);
    expect(usesPlates("Lat Pulldowns")).toBe(false);
    expect(usesPlates("Leg Press")).toBe(false);
    expect(usesPlates("Cable Rows")).toBe(false);
  });

  it("dumbbells step to the next available pair (~2 kg per hand)", () => {
    expect(nextLoadKg(30, "Dumbbell")).toBe(32);
    expect(nextLoadKg(8, "Dumbbell")).toBe(9);
    expect(nextLoadKg(10, "Dumbbell")).toBe(12);
    expect(nextLoadKg(31, "Dumbbell")).toBe(32); // odd load → next available
    expect(roundToLoadable(27, "Dumbbell")).toBe(26); // tie → lighter
  });

  it("barbell +2.5, cable +2.5, machine +5", () => {
    expect(nextLoadKg(100, "Barbell")).toBe(102.5);
    expect(nextLoadKg(40, "Cable")).toBe(42.5);
    expect(nextLoadKg(120, "Machine")).toBe(125);
  });

  it("program text sets the increment (5×5 deadlift 'add 5kg each session')", () => {
    expect(incrementFromText("One heavy set, add 5kg each session")).toBe(5);
    expect(incrementFromText("Add 2.5kg each session")).toBe(2.5);
    expect(incrementFromText("Double progression")).toBeNull();
    expect(nextLoadKg(140, "Barbell", "add 5kg each session")).toBe(145);
  });
});

describe("double progression", () => {
  it("returns null with no weighted sets", () => {
    expect(suggestProgression("Bench Press", [], "8-12")).toBeNull();
    expect(
      suggestProgression("Bench Press", [{ weightKg: null, reps: 10 }], "8-12")
    ).toBeNull();
  });

  it("barbell: adds 2.5 kg when every working set hits the ceiling", () => {
    const s = suggestProgression("Bench Press", session(100, [12, 12]).sets, "8-12")!;
    expect(s.kind).toBe("add");
    expect(s.suggestedWeightKg).toBe(102.5);
    expect(s.targetReps).toBe(8); // reset to the bottom of the range
  });

  it("dumbbell isolation: next dumbbell, not +1.25 kg (audit: 'Add 9.25 kg')", () => {
    const s = suggestProgression(
      "Lateral Raise",
      session(8, [15, 15, 15]).sets,
      "12-15"
    )!;
    expect(s.suggestedWeightKg).toBe(9);
  });

  it("repeats when the ceiling was not reached", () => {
    const s = suggestProgression("Squat", session(100, [12, 10]).sets, "8-12")!;
    expect(s.kind).toBe("repeat");
    expect(s.text).toBe("Repeat 100kg · aim 12 reps");
  });

  it("ignores warm-ups below 85% of the top load", () => {
    const sets = [
      { weightKg: 80, reps: 5 },
      { weightKg: 100, reps: 12 },
    ];
    expect(suggestProgression("Deadlift", sets, "8-12")!.isProgress).toBe(true);
  });

  it("back-off sets count as working sets (audit: 80×10 + 70×6 is not 'add weight')", () => {
    const sets = [
      { weightKg: 80, reps: 10 },
      { weightKg: 70, reps: 6 },
      { weightKg: 70, reps: 6 },
    ];
    expect(suggestProgression("Bench Press", sets, "6-10")!.isProgress).toBe(false);
  });

  it("AMRAP never says 'add weight → × 8' (audit 05 #15)", () => {
    const s = suggestProgression("Weighted Dips", session(10, [15, 12]).sets, "AMRAP")!;
    expect(s.isProgress).toBe(false);
    expect(s.text).toBe("Repeat 10kg · beat 15 reps");
    expect(s.targetReps).toBe(16);
  });

  it("time-based targets are not reps", () => {
    const s = suggestProgression("Plank", [{ weightKg: null, reps: 45 }], "30-60s")!;
    expect(s.kind).toBe("time");
    expect(s.suggestedWeightKg).toBeNull();
  });
});

describe("stall ⇒ deload to 90% (Starting Strength / StrongLifts reset)", () => {
  it("bench 6–10 stuck at 62.5 × 8/7/6 for 3 sessions ⇒ 0.9 × 62.5 = 56.25 → 55", () => {
    const sessions = [
      session(60, [10, 10, 10]),
      session(62.5, [8, 7, 6]),
      session(62.5, [8, 7, 6]),
      session(62.5, [8, 7, 6]),
    ];
    const s = suggestNext({ exerciseName: "Bench Press", reps: "6-10", sessions })!;
    expect(s.kind).toBe("deload");
    expect(s.suggestedWeightKg).toBe(55); // nearest 2.5 kg, tie → lighter
    expect(s.targetReps).toBe(6);
  });

  it("declining reps at the same load (10/10/9 → 10/9/8 → 9/8/7) is a stall", () => {
    const sessions = [
      session(80, [10, 10, 9]),
      session(80, [10, 9, 8]),
      session(80, [9, 8, 7]),
    ];
    expect(detectStall(sessions, { low: 6, high: 10 })).toEqual({
      stalled: true,
      weightKg: 80,
    });
  });

  it("rep gains inside the range are progress, not a stall", () => {
    const sessions = [
      session(80, [8, 7, 6]),
      session(80, [8, 8, 7]),
      session(80, [9, 8, 8]),
    ];
    expect(detectStall(sessions, { low: 6, high: 10 }).stalled).toBe(false);
    const s = suggestNext({ exerciseName: "Bench Press", reps: "6-10", sessions })!;
    expect(s.kind).toBe("repeat");
  });

  it("5×5 squat failing 3 sessions at 105 ⇒ 94.5 → 95 kg (rep gains don't matter)", () => {
    const sessions = [
      session(105, [5, 5, 4, 4, 3]),
      session(105, [5, 4, 4, 3, 3]),
      session(105, [5, 5, 5, 4, 4]),
    ];
    const s = suggestNext({ exerciseName: "Barbell Squats", reps: "5", sessions })!;
    expect(s.kind).toBe("deload");
    expect(s.suggestedWeightKg).toBe(95);
    expect(s.text).toBe("Stalled 3× at 105kg → deload 95kg × 5");
  });

  it("dumbbell deload rounds to an available dumbbell", () => {
    const sessions = [session(30, [8, 8]), session(30, [8, 8]), session(30, [8, 7])];
    const s = suggestNext({
      exerciseName: "Incline Dumbbell Press",
      reps: "8-12",
      sessions,
    })!;
    expect(s.suggestedWeightKg).toBe(26); // 0.9 × 30 = 27 → 26 | 28 tie → lighter
  });

  it("needs three sessions at the same load", () => {
    const sessions = [session(100, [5, 5, 4, 4, 3]), session(105, [5, 5, 4, 4, 3])];
    expect(detectStall(sessions, { low: 5, high: 5 }).stalled).toBe(false);
  });
});
