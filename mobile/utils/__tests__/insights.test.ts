import { describe, expect, it } from "vitest";
import { INSIGHTS_MIN_DAYS, buildInsights, daysUntilInsights } from "../insights";
import type { DailyScore } from "../../api/scores";
import type { LogEntry } from "../../types/appTypes";

const row = (date: string, score: number, workoutDone = false): DailyScore => ({
  date,
  score,
  tasksDone: 0,
  tasksTotal: 0,
  suppDone: 0,
  suppTotal: 0,
  mealsDone: 0,
  mealsTotal: 0,
  workoutDone,
  protein: 0,
  calories: 0,
});
const sleepLog = (date: string, sleep: string): LogEntry => ({
  date,
  day: "",
  bw: "",
  sleep,
  steps: "",
  top: "",
  notes: "",
});
const day = (i: number) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);

describe("daysUntilInsights", () => {
  it("counts down to the unlock", () => {
    expect(daysUntilInsights([])).toBe(INSIGHTS_MIN_DAYS);
    expect(daysUntilInsights(Array.from({ length: 20 }, (_, i) => row(day(i), 50)))).toBe(
      0
    );
  });
});

describe("buildInsights", () => {
  it("nothing before 14 days", () => {
    expect(buildInsights([row(day(0), 90)], [])).toEqual([]);
  });

  it("finds sleep and training effects ≥ 10 points with ≥ 3 per group", () => {
    const history: DailyScore[] = [];
    const logs: LogEntry[] = [];
    for (let i = 0; i < 14; i++) {
      const goodNight = i % 2 === 0;
      history.push(row(day(i), goodNight ? 90 : 60, goodNight));
      logs.push(sleepLog(day(i), goodNight ? "7,5" : "5.5"));
    }
    const insights = buildInsights(history, logs);
    const ids = insights.map((x) => x.id);
    expect(ids).toContain("sleep_score");
    expect(ids).toContain("training_score");
    const sleep = insights.find((x) => x.id === "sleep_score")!;
    expect(sleep).toMatchObject({ aValue: 90, bValue: 60, effect: 30, sampleSize: 14 });
    // sorted by effect, descending
    for (let i = 1; i < insights.length; i++)
      expect(insights[i - 1].effect).toBeGreaterThanOrEqual(insights[i].effect);
  });

  it("no insight when the difference is under 10 points", () => {
    const history = Array.from({ length: 14 }, (_, i) =>
      row(day(i), 70 + (i % 2) * 5, i % 2 === 0)
    );
    expect(
      buildInsights(history, []).find((x) => x.id === "training_score")
    ).toBeUndefined();
  });

  it("peak weekday needs ≥ 2 samples and a 10-point lead", () => {
    // 2026-09-07 is a Monday: Mondays score 100, everything else 50
    const history = Array.from({ length: 21 }, (_, i) => {
      const date = day(i);
      const monday = new Date(date + "T00:00:00").getDay() === 1;
      return row(date, monday ? 100 : 50);
    });
    const peak = buildInsights(history, []).find((x) => x.id === "best_weekday")!;
    expect(peak.aLabel).toBe("Mon");
    expect(peak.aValue).toBe(100);
  });
});
