import { describe, expect, it } from "vitest";
import { plateBreakdown, warmupRamp } from "../plates";

describe("plateBreakdown", () => {
  it("builds standard loads", () => {
    expect(plateBreakdown(100)).toBe("25 + 15 per side");
    expect(plateBreakdown(60)).toBe("20 per side");
    expect(plateBreakdown(102.5)).toBe("25 + 15 + 1.25 per side");
  });

  it("returns null at or below bar weight", () => {
    expect(plateBreakdown(20)).toBeNull();
    expect(plateBreakdown(15)).toBeNull();
  });

  it("returns null for unbuildable remainders (machine numbers)", () => {
    expect(plateBreakdown(101)).toBeNull();
  });
});

describe("warmupRamp", () => {
  it("ramps 40/60/80 rounded to 2.5", () => {
    expect(warmupRamp(100)).toEqual([
      { weightKg: 40, reps: 8 },
      { weightKg: 60, reps: 5 },
      { weightKg: 80, reps: 3 },
    ]);
  });

  it("collapses duplicates for light working weights", () => {
    const ramp = warmupRamp(40);
    const weights = ramp.map((s) => s.weightKg);
    expect(new Set(weights).size).toBe(weights.length);
    expect(weights.every((w) => w < 40)).toBe(true);
  });

  it("empty for very light or invalid weights", () => {
    expect(warmupRamp(25)).toEqual([]);
    expect(warmupRamp(NaN)).toEqual([]);
  });
});
