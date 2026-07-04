import { describe, expect, it } from "vitest";
import { parseRepRange, suggestProgression } from "../progression";

describe("parseRepRange", () => {
  it("parses a range", () => {
    expect(parseRepRange("8-12")).toEqual({ low: 8, high: 12 });
  });

  it("parses a single number as both bounds", () => {
    expect(parseRepRange("5")).toEqual({ low: 5, high: 5 });
  });

  it("defaults to 8 when no number present", () => {
    expect(parseRepRange("AMRAP")).toEqual({ low: 8, high: 8 });
    expect(parseRepRange("")).toEqual({ low: 8, high: 8 });
  });
});

describe("suggestProgression", () => {
  it("returns null with no weighted sets", () => {
    expect(suggestProgression("Bench Press", [], "8-12")).toBeNull();
    expect(
      suggestProgression("Bench Press", [{ weightKg: null, reps: 10 }], "8-12")
    ).toBeNull();
  });

  it("adds 2.5kg for compounds when all top sets hit the rep ceiling", () => {
    const sets = [
      { weightKg: 100, reps: 12 },
      { weightKg: 100, reps: 12 },
    ];
    const s = suggestProgression("Bench Press", sets, "8-12");
    expect(s).not.toBeNull();
    expect(s!.isProgress).toBe(true);
    expect(s!.suggestedWeightKg).toBe(102.5);
  });

  it("adds 1.25kg for isolation exercises", () => {
    const sets = [{ weightKg: 20, reps: 15 }];
    const s = suggestProgression("Lateral Raise", sets, "12-15");
    expect(s!.isProgress).toBe(true);
    expect(s!.suggestedWeightKg).toBe(21.25);
  });

  it("repeats the weight when the ceiling was not reached", () => {
    const sets = [
      { weightKg: 100, reps: 12 },
      { weightKg: 100, reps: 10 },
    ];
    const s = suggestProgression("Squat", sets, "8-12");
    expect(s!.isProgress).toBe(false);
  });

  it("only considers sets at the top weight", () => {
    const sets = [
      { weightKg: 80, reps: 5 }, // warmup below top weight
      { weightKg: 100, reps: 12 },
    ];
    const s = suggestProgression("Deadlift", sets, "8-12");
    expect(s!.isProgress).toBe(true);
  });
});
