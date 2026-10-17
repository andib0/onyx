import { describe, expect, it } from "vitest";
import {
  nextProgramDayId,
  planForDate,
  resolveProgramCursor,
  sessionsPerWeek,
  trainingWeekdays,
} from "../programSchedule";
import { programs } from "../../../backend/prisma/seed/programs";

const days = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `d${i + 1}`, dayOrder: i + 1 }));

describe("sessionsPerWeek", () => {
  it("reads explicit frequency from the name/description", () => {
    expect(sessionsPerWeek({ name: "Beginner Full Body 3x/Week", days: days(3) })).toBe(
      3
    );
    expect(sessionsPerWeek({ name: "Push Pull Legs 6-Day", days: days(6) })).toBe(6);
    expect(
      sessionsPerWeek({ name: "X", description: "4 times per week", days: days(2) })
    ).toBe(4);
  });
  it("5×5 A/B runs 3×/week by convention; else one session per program day", () => {
    expect(sessionsPerWeek({ name: "Strength Focus - 5x5", days: days(2) })).toBe(3);
    expect(sessionsPerWeek({ name: "Custom", days: days(4) })).toBe(4);
    expect(sessionsPerWeek({ name: "Empty", days: [] })).toBe(1);
  });
  it("every seeded program has a sensible frequency", () => {
    const got = Object.fromEntries(
      programs.map((p) => [p.name, sessionsPerWeek(p as never)])
    );
    for (const value of Object.values(got)) {
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(6);
    }
  });
});

describe("planned rest days from frequency", () => {
  it("3-day program → Mon/Wed/Fri with rest days between", () => {
    expect(trainingWeekdays(3)).toEqual([0, 2, 4]);
    // Week of Mon 2026-10-12
    const week = ["12", "13", "14", "15", "16", "17", "18"].map((d) =>
      planForDate(`2026-10-${d}`, 3)
    );
    expect(week).toEqual(["train", "rest", "train", "rest", "train", "rest", "rest"]);
  });
  it("no two training days in a row for ≤ 3/week; 6/week leaves Sunday off", () => {
    for (const n of [1, 2, 3]) {
      const t = trainingWeekdays(n);
      for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeGreaterThan(1);
    }
    expect(planForDate("2026-10-18", 6)).toBe("rest");
    expect(planForDate("2026-10-17", 6)).toBe("train");
    expect(trainingWeekdays(7)).toHaveLength(7);
  });
});

describe("program cursor (audit 05 #7)", () => {
  it("nextProgramDayId wraps and follows dayOrder", () => {
    const shuffled = [
      { id: "c", dayOrder: 3 },
      { id: "a", dayOrder: 1 },
      { id: "b", dayOrder: 2 },
    ];
    expect(nextProgramDayId(shuffled, "a")).toBe("b");
    expect(nextProgramDayId(shuffled, "c")).toBe("a");
    expect(nextProgramDayId(shuffled, "zzz")).toBe("a");
    expect(nextProgramDayId([], "a")).toBe("");
  });

  it("advances after a completed workout once the date rolls over", () => {
    const base = { days: days(3), lastCompletion: { date: "2026-10-12", dayId: "d1" } };
    // Same day: today's finished workout stays selected
    expect(
      resolveProgramCursor(
        Object.assign({}, base, { selectedDayId: "d1", today: "2026-10-12" })
      )
    ).toBe("d1");
    // Next day: cursor moves on
    expect(
      resolveProgramCursor(
        Object.assign({}, base, { selectedDayId: "d1", today: "2026-10-13" })
      )
    ).toBe("d2");
    // Already advanced / manually changed → untouched
    expect(
      resolveProgramCursor(
        Object.assign({}, base, { selectedDayId: "d3", today: "2026-10-14" })
      )
    ).toBe("d3");
  });

  it("no completion → no change", () => {
    expect(
      resolveProgramCursor({
        days: days(3),
        selectedDayId: "d2",
        lastCompletion: null,
        today: "2026-10-13",
      })
    ).toBe("d2");
  });
});
