import { describe, expect, it } from "vitest";
import { MAJOR_MUSCLES, weeklySetsPerMuscle } from "../programVolume";
import { incrementFromText } from "../progression";
import { programs } from "../../../backend/prisma/seed/programs";

// Judge for Bet 6 / audit 05 #11: every non-beginner seeded program gives each
// major muscle ≥ 10 weekly hard sets (Schoenfeld, Ogborn & Krieger 2017), counted
// fractionally (Pelland et al. 2024). Beginner programs (description says so)
// are exempt — MEV for novices is lower and technique practice dominates.
const isBeginner = (p: { description: string }) => /beginner/i.test(p.description);

describe("weeklySetsPerMuscle", () => {
  it("counts direct 1.0 / indirect 0.5 and scales by weekly frequency", () => {
    const result = weeklySetsPerMuscle({
      name: "Test Upper/Lower",
      description: "4x/week",
      days: [
        { exercises: [{ exerciseName: "Bench Press", sets: "3" }] },
        { exercises: [{ exerciseName: "Squats", sets: "4" }] },
      ],
    });
    // Bench: 3 sets × 2/week = 6 chest, 3 triceps, 3 shoulders; squat 8 quads, 4 glutes
    expect(result.sets).toEqual({
      Chest: 6,
      Triceps: 3,
      Shoulders: 3,
      Quads: 8,
      Glutes: 4,
    });
    expect(result.unknown).toEqual([]);
  });
});

describe("seeded programs", () => {
  const table = programs.map((p) => ({
    name: p.name,
    ...weeklySetsPerMuscle(p as never),
  }));

  it("print the weekly volume table (for the log)", () => {
    for (const row of table) {
      const cells = MAJOR_MUSCLES.map((m) => `${m} ${row.sets[m] ?? 0}`).join(" · ");
      console.log(`${row.name}: ${cells}`);
    }
    expect(table.length).toBe(programs.length);
  });

  for (const p of programs) {
    it(`${p.name}: every exercise is in the library`, () => {
      expect(weeklySetsPerMuscle(p as never).unknown).toEqual([]);
    });
    if (isBeginner(p)) continue;
    it(`${p.name}: ≥ 10 weekly sets for every major muscle`, () => {
      const { sets } = weeklySetsPerMuscle(p as never);
      const low = MAJOR_MUSCLES.filter((m) => (sets[m] ?? 0) < 10).map(
        (m) => `${m}=${sets[m] ?? 0}`
      );
      expect(low).toEqual([]);
    });
  }

  it("progression text matches the engine (no 'add 5kg' the engine ignores)", () => {
    for (const p of programs)
      for (const d of p.days)
        for (const e of d.exercises) {
          const inc = incrementFromText(`${e.notes} ${e.progression}`);
          if (inc !== null) expect([1, 1.25, 2, 2.5, 5]).toContain(inc);
        }
  });
});
