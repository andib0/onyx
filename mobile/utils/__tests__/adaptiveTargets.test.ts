import { describe, expect, it } from "vitest";
import { adaptiveTdee, suggestProteinTarget } from "../adaptiveTargets";
import type { DailyScore } from "../../api/scores";

const TODAY = "2026-10-17";
const dayKey = (offset: number) =>
  new Date(Date.UTC(2026, 9, 17 + offset)).toISOString().slice(0, 10);

const score = (date: string, protein: number, calories = 2000): DailyScore => ({
  date,
  score: 0,
  tasksDone: 0,
  tasksTotal: 0,
  suppDone: 0,
  suppTotal: 0,
  mealsDone: 0,
  mealsTotal: 0,
  workoutDone: false,
  protein,
  calories,
});

describe("suggestProteinTarget", () => {
  const eats = (g: number, days = 14) =>
    Array.from({ length: days }, (_, i) => score(dayKey(-days + i), g));

  it("never suggests below 1.6 g/kg (audit 05 #3: 160 → 95 g = 1.19 g/kg)", () => {
    const s = suggestProteinTarget(eats(100), 160, { todayKey: TODAY, weightKg: 80 })!;
    expect(s.suggested).toBe(130); // floor 128 → nearest 5 up
    expect(s.direction).toBe("lower");
    expect(s.suggested / 80).toBeGreaterThanOrEqual(1.6);
  });

  it("without weight, keeps the old behaviour (nearest 5 g of the average)", () => {
    expect(suggestProteinTarget(eats(100), 160)!.suggested).toBe(100);
  });

  it("no suggestion when the current target is already at the floor", () => {
    expect(
      suggestProteinTarget(eats(100), 130, { todayKey: TODAY, weightKg: 80 })
    ).toBeNull();
  });

  it("raises when the lifter consistently eats more", () => {
    const s = suggestProteinTarget(eats(190), 160, { todayKey: TODAY, weightKg: 80 })!;
    expect(s).toMatchObject({ suggested: 190, direction: "raise" });
  });

  it("excludes today's partial day", () => {
    const history = eats(150, 7).concat([score(TODAY, 10)]);
    // with today: avg of 8 days = 132 → suggestion; without: 150 vs 160 = 6% → none
    expect(suggestProteinTarget(history, 160, { todayKey: TODAY })).toBeNull();
    expect(suggestProteinTarget(history, 160)).not.toBeNull();
  });

  it("needs ≥ 7 logged days and a target", () => {
    expect(suggestProteinTarget(eats(100, 6), 160)).toBeNull();
    expect(suggestProteinTarget(eats(100), 0)).toBeNull();
  });
});

describe("adaptiveTdee — energy balance (7700 kcal/kg)", () => {
  // 14 days eating 2500 kcal while losing 0.5 kg/week exactly:
  // TDEE = 2500 + 7700 × 0.5 / 7 = 3050
  const intake = (kcal: number, days = 14) =>
    Array.from({ length: days }, (_, i) => ({ date: dayKey(-days + i), calories: kcal }));
  const weights = (start: number, perWeek: number, days = 14) =>
    Array.from({ length: days }, (_, i) => ({
      date: dayKey(-days + i),
      weightKg: start + (perWeek / 7) * i,
    }));

  it("back-calculates TDEE from intake and the weight trend", () => {
    const r = adaptiveTdee({
      intake: intake(2500),
      weighIns: weights(80, -0.5),
      formulaTdee: 2800,
      todayKey: TODAY,
    })!;
    expect(r.weeklyChangeKg).toBeCloseTo(-0.5, 6);
    expect(r.tdee).toBe(3050);
    expect(r.clamped).toBe(false);
  });

  it("stable weight → TDEE = average intake", () => {
    const r = adaptiveTdee({
      intake: intake(2600),
      weighIns: weights(80, 0),
      formulaTdee: 2800,
      todayKey: TODAY,
    })!;
    expect(r.tdee).toBe(2600);
  });

  it("clamps to ±25% of the formula (under-logging can't produce 1500)", () => {
    const r = adaptiveTdee({
      intake: intake(1500),
      weighIns: weights(80, 0),
      formulaTdee: 2800,
      todayKey: TODAY,
    })!;
    expect(r.rawTdee).toBe(1500);
    expect(r.tdee).toBe(2100);
    expect(r.clamped).toBe(true);
  });

  it("accepts LogEntry weigh-ins (bw strings)", () => {
    const entries = weights(80, -0.5).map((w) => ({
      date: w.date,
      day: "",
      bw: w.weightKg.toFixed(3),
      sleep: "",
      steps: "",
      top: "",
      notes: "",
    }));
    const r = adaptiveTdee({
      intake: intake(2500),
      weighIns: entries,
      formulaTdee: 2800,
      todayKey: TODAY,
    })!;
    expect(Math.abs(r.tdee - 3050)).toBeLessThanOrEqual(1);
  });

  it("null with < 10 intake days, < 14 days of weigh-ins, or only today's data", () => {
    expect(
      adaptiveTdee({
        intake: intake(2500, 9),
        weighIns: weights(80, 0),
        formulaTdee: 2800,
        todayKey: TODAY,
      })
    ).toBeNull();
    expect(
      adaptiveTdee({
        intake: intake(2500),
        weighIns: weights(80, 0, 10),
        formulaTdee: 2800,
        todayKey: TODAY,
      })
    ).toBeNull();
    // Intake logged today is excluded (partial day)
    const withToday = intake(2500, 9).concat([{ date: TODAY, calories: 900 }]);
    expect(
      adaptiveTdee({
        intake: withToday,
        weighIns: weights(80, 0),
        formulaTdee: 2800,
        todayKey: TODAY,
      })
    ).toBeNull();
  });
});
