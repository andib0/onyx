import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  OUTCOME_WEIGHTS,
  addDaysKey,
  computeOutcomeScore,
  computeStreak,
  isoWeekKey,
  type DayOutcome,
  type OutcomeInput,
} from "../outcomeScore";

// Oracle: contracts/outcome_score_reference.py → contracts/score-vectors.json
// (docs/audit/04-score-and-prediction.md §A4). Every vector must match exactly.
const here = dirname(fileURLToPath(import.meta.url));
const vectorsPath = resolve(here, "../../../contracts/score-vectors.json");
type Vector = {
  name: string;
  input: OutcomeInput;
  expected: {
    score: number | null;
    kept: boolean;
    components: Record<"T" | "Pr" | "Ca" | "Bw", number | null>;
  };
};
const contract = JSON.parse(readFileSync(vectorsPath, "utf8")) as {
  weights: Record<string, number>;
  vectors: Vector[];
};

describe("computeOutcomeScore — contract vectors", () => {
  it("uses the contract weights", () => {
    expect(OUTCOME_WEIGHTS).toEqual(contract.weights);
  });

  it("has vectors to check", () => {
    expect(contract.vectors.length).toBeGreaterThanOrEqual(14);
  });

  for (const v of contract.vectors) {
    it(v.name, () => {
      const out = computeOutcomeScore(v.input);
      expect(out.score).toBe(v.expected.score);
      expect(out.kept).toBe(v.expected.kept);
      for (const key of ["T", "Pr", "Ca", "Bw"] as const) {
        const want = v.expected.components[key];
        if (want === null) expect(out.components[key]).toBeNull();
        else expect(out.components[key]).toBeCloseTo(want, 4);
      }
    });
  }
});

describe("computeOutcomeScore — audit counter-examples (Bet 5 judges)", () => {
  const base: OutcomeInput = {
    plan: "train",
    setsDone: 15,
    setsPlanned: 15,
    protein: 160,
    proteinTarget: 160,
    calories: 2500,
    calorieTarget: 2500,
    bwSlope: -0.4,
    goalRate: -0.4,
  };
  it("skipped session + 50% protein scores < 60", () => {
    const s = computeOutcomeScore({ ...base, setsDone: 0, protein: 80 });
    expect(s.score).not.toBeNull();
    expect(s.score!).toBeLessThan(60);
  });
  it("a perfectly executed planned rest day scores 100", () => {
    expect(computeOutcomeScore({ ...base, plan: "rest", setsDone: 0 }).score).toBe(100);
  });
  it("a zero protein target is treated as unknown, not division by zero", () => {
    const s = computeOutcomeScore({ ...base, proteinTarget: 0 });
    expect(s.components.Pr).toBeNull();
    expect(s.kept).toBe(false);
  });
});

// ---- Streak (contracts/README.md "Streak") ----

const TODAY = "2026-10-15"; // Thursday, ISO week 2026-W42 (Mon 10-12 … Sun 10-18)
const kept = (date: string): DayOutcome => ({ date, score: 90, kept: true });
const missed = (date: string): DayOutcome => ({ date, score: 40, kept: false });
const unscored = (date: string): DayOutcome => ({ date, score: null, kept: false });
const ago = (n: number) => addDaysKey(TODAY, -n);

describe("date helpers", () => {
  it("isoWeekKey groups Mon–Sun", () => {
    expect(isoWeekKey("2026-10-12")).toBe(isoWeekKey("2026-10-18")); // Mon..Sun
    expect(isoWeekKey("2026-10-11")).not.toBe(isoWeekKey("2026-10-12")); // Sun | Mon
    // Year boundary: 2026-12-31 (Thu) and 2027-01-03 (Sun) share ISO week 2026-W53
    expect(isoWeekKey("2026-12-31")).toBe(isoWeekKey("2027-01-03"));
  });
  it("addDaysKey crosses months and DST-free", () => {
    expect(addDaysKey("2026-03-31", 1)).toBe("2026-04-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysKey("2026-10-25", 1)).toBe("2026-10-26"); // EU DST change day
  });
});

describe("computeStreak", () => {
  it("counts consecutive kept days ending yesterday, plus today when kept", () => {
    const h = [kept(ago(3)), kept(ago(2)), kept(ago(1)), kept(TODAY)];
    expect(computeStreak(h, TODAY)).toMatchObject({ count: 4, state: "kept" });
  });

  it("today pending never shows 0 when yesterday's streak > 0", () => {
    const h = [kept(ago(2)), kept(ago(1))];
    expect(computeStreak(h, TODAY)).toMatchObject({ count: 2, state: "pending" });
    // An explicit not-yet-kept row for today is still pending, not a break
    expect(computeStreak(h.concat([missed(TODAY)]), TODAY)).toMatchObject({
      count: 2,
      state: "pending",
    });
  });

  it("morning after a single miss: grace keeps the streak (audit 04 A3.1 fixed)", () => {
    // Mon 12 kept, Tue 13 kept, Wed 14 missed (grace), today Thu pending
    const h = [kept(ago(3)), kept(ago(2)), missed(ago(1))];
    const s = computeStreak(h, TODAY);
    expect(s.count).toBe(2); // grace does not add
    expect(s.state).toBe("pending");
    expect(s.graceUsedThisWeek).toBe(true);
  });

  it("a second miss in the same ISO week breaks the streak", () => {
    // Mon 12 missed, Tue 13 kept, Wed 14 missed — both in W42
    const h = [kept(ago(4)), missed(ago(3)), kept(ago(2)), missed(ago(1))];
    expect(computeStreak(h, TODAY).count).toBe(1); // only Tue 13 counts
  });

  it("grace resets per ISO week, not rolling 8 days (audit 04 A3.3)", () => {
    // Misses on Sun 2026-10-11 (W41) and Wed 2026-10-14 (W42): one grace each week
    const h = [
      kept("2026-10-08"),
      kept("2026-10-09"),
      kept("2026-10-10"),
      missed("2026-10-11"),
      kept("2026-10-12"),
      kept("2026-10-13"),
      missed("2026-10-14"),
    ];
    expect(computeStreak(h, TODAY).count).toBe(5);
    // Misses 7 days apart in different weeks: d-3 (Mon W42) and d-10 (Mon W41)
    const h2: DayOutcome[] = [];
    for (let n = 14; n >= 1; n--)
      h2.push(n === 3 || n === 10 ? missed(ago(n)) : kept(ago(n)));
    expect(computeStreak(h2, TODAY).count).toBe(12);
  });

  it("unscored days (nothing logged) count as not kept and get no grace", () => {
    const h = [kept(ago(3)), kept(ago(2)), unscored(ago(1))];
    expect(computeStreak(h, TODAY)).toMatchObject({ count: 0, state: "none" });
    // A missing row is the same as an unscored day
    expect(computeStreak([kept(ago(3)), kept(ago(2))], TODAY).count).toBe(0);
  });

  it("empty history → 0, none; kept today alone → 1", () => {
    expect(computeStreak([], TODAY)).toMatchObject({ count: 0, state: "none" });
    expect(computeStreak([kept(TODAY)], TODAY)).toMatchObject({
      count: 1,
      state: "kept",
    });
  });

  it("handles a 365-day kept history (no 30-day cap, audit 04 A3.5)", () => {
    const h: DayOutcome[] = [];
    for (let n = 400; n >= 1; n--) h.push(kept(ago(n)));
    h.push(kept(TODAY));
    expect(computeStreak(h, TODAY).count).toBe(401);
    expect(computeStreak(h.slice(-366), TODAY).count).toBe(366);
  });

  it("ignores future rows and unsorted input", () => {
    const h = [kept(ago(1)), kept(addDaysKey(TODAY, 1)), kept(ago(2))];
    expect(computeStreak(h, TODAY).count).toBe(2);
  });
});
