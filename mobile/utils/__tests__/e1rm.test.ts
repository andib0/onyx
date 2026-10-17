import { describe, expect, it } from "vitest";
import {
  bestE1rm,
  brzycki,
  createPrTracker,
  epley,
  estimateE1rm,
  registerSet,
} from "../e1rm";

describe("e1RM equations", () => {
  // Epley 1985: w(1 + r/30). 100 × 5 → 116.67; Brzycki 1993: w·36/(37−r) → 112.5
  it("Epley and Brzycki match their published forms", () => {
    expect(epley(100, 5)).toBeCloseTo(116.667, 3);
    expect(brzycki(100, 5)).toBeCloseTo(112.5, 6);
    expect(epley(100, 10)).toBeCloseTo(133.333, 3);
    expect(brzycki(100, 10)).toBeCloseTo(133.333, 3); // the two agree at 10 reps
  });

  it("a true single is its own 1RM (no +3.3% Epley inflation, audit 05 #14)", () => {
    expect(epley(100, 1)).toBe(100);
    expect(brzycki(100, 1)).toBe(100);
    expect(estimateE1rm(100, 1)).toBe(100);
  });

  it("Epley and Brzycki stay within 4% of each other for 2–10 reps (cross-check)", () => {
    for (let r = 2; r <= 10; r++) {
      const e = epley(100, r);
      const b = brzycki(100, r);
      expect(Math.abs(e - b) / b).toBeLessThan(0.04);
    }
  });

  it("ignores sets above 10 reps and invalid input", () => {
    expect(estimateE1rm(60, 11)).toBeNull();
    expect(estimateE1rm(60, 0)).toBeNull();
    expect(estimateE1rm(0, 5)).toBeNull();
    expect(estimateE1rm(null, 5)).toBeNull();
    expect(estimateE1rm(60, null)).toBeNull();
  });

  it("bestE1rm skips high-rep sets", () => {
    expect(
      bestE1rm([
        { weightKg: 60, reps: 20 }, // would be 100 by Epley — ignored
        { weightKg: 80, reps: 5 },
      ])
    ).toBeCloseTo(93.333, 3);
    expect(bestE1rm([])).toBeNull();
  });
});

describe("PR detection vs all-time best (audit 05 #6)", () => {
  const history = {
    "Barbell Bench Press": [
      { weightKg: 100, reps: 5 }, // e1RM 116.7 — all-time best, months ago
      { weightKg: 80, reps: 8 }, // last session after a light week: 101.3
    ],
  };

  it("a light day after a deload is not a PR", () => {
    const t = createPrTracker(history);
    expect(registerSet(t, "Barbell Bench Press", { weightKg: 85, reps: 8 }).isPr).toBe(
      false
    );
  });

  it("at most one PR per exercise per session", () => {
    let t = createPrTracker(history);
    const results: boolean[] = [];
    for (const w of [102.5, 105, 107.5]) {
      const r = registerSet(t, "Barbell Bench Press", { weightKg: w, reps: 5 });
      results.push(r.isPr);
      t = r.tracker;
    }
    expect(results).toEqual([true, false, false]);
  });

  it("recognises an e1RM PR at a lower weight with more reps", () => {
    const t = createPrTracker(history);
    // 95 × 8 → 120.3 > 116.7
    expect(registerSet(t, "Barbell Bench Press", { weightKg: 95, reps: 8 }).isPr).toBe(
      true
    );
  });

  it("first-ever session of a lift can't be a PR (nothing to beat)", () => {
    let t = createPrTracker({});
    const a = registerSet(t, "Deadlift", { weightKg: 100, reps: 5 });
    t = a.tracker;
    const b = registerSet(t, "Deadlift", { weightKg: 110, reps: 5 });
    expect([a.isPr, b.isPr]).toEqual([false, false]);
  });

  it("a high-rep set can't be a PR", () => {
    const t = createPrTracker(history);
    expect(registerSet(t, "Barbell Bench Press", { weightKg: 90, reps: 15 }).isPr).toBe(
      false
    );
  });
});
