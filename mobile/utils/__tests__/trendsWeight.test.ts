import { describe, expect, it } from "vitest";
import {
  buildWeeklyAdherence,
  buildWeightTrend,
  buildYesterdayRecap,
  dateKeyDaysAgo,
  scoreBarsFromHistory,
  supplementStreak,
  trendWeightKg,
  weightSlopeKgPerWeek,
} from "../trends";
import type { AppState, LogEntry } from "../../types/appTypes";

const entry = (date: string, bw: string): LogEntry => ({
  date,
  day: "",
  bw,
  sleep: "",
  steps: "",
  top: "",
  notes: "",
});

// Exact linear series: 80 kg falling 0.1 kg/day → slope −0.7 kg/week (OLS of a
// perfect line returns the line).
function linear(days: number, start = 80, perDay = -0.1): LogEntry[] {
  const out: LogEntry[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
    out.push(entry(d, String(Math.round((start + perDay * i) * 100) / 100)));
  }
  return out;
}

describe("weightSlopeKgPerWeek", () => {
  it("recovers the slope of a perfect line", () => {
    expect(weightSlopeKgPerWeek(linear(20))).toBeCloseTo(-0.7, 6);
  });
  it("uses only the last 14 weigh-ins", () => {
    // 10 flat days then 14 days of +0.1/day: last-14 slope is +0.7
    const flat = linear(10, 80, 0);
    const rising = linear(24, 79, 0.1).slice(10);
    expect(weightSlopeKgPerWeek(flat.concat(rising))).toBeCloseTo(0.7, 6);
  });
  it("null with < 3 weigh-ins; ignores blanks and parses commas", () => {
    expect(weightSlopeKgPerWeek([entry("2026-01-01", "80")])).toBeNull();
    const withJunk = [
      entry("2026-01-01", "80,0"),
      entry("2026-01-02", ""),
      entry("2026-01-03", "79,8"),
      entry("2026-01-05", "79.6"),
    ];
    expect(weightSlopeKgPerWeek(withJunk)).toBeCloseTo(-0.7, 6);
  });
});

describe("trendWeightKg", () => {
  it("null below 7 weigh-ins (caller falls back to profile weight)", () => {
    expect(trendWeightKg(linear(6))).toBeNull();
  });
  it("returns the regression value at the latest weigh-in", () => {
    // Noise-free line ending at 80 − 0.1·9 = 79.1
    expect(trendWeightKg(linear(10))).toBe(79.1);
  });
  it("damps a single outlier morning", () => {
    const series = linear(10, 80, 0);
    series[9] = entry(series[9].date, "82"); // +2 kg water spike
    const trend = trendWeightKg(series)!;
    expect(trend).toBeLessThan(81);
    expect(trend).toBeGreaterThan(80);
  });
});

describe("buildWeightTrend", () => {
  it("empty for no data and no rate below 3 points", () => {
    expect(buildWeightTrend([])).toEqual({
      points: [],
      currentKg: null,
      weeklyRateKg: null,
    });
    const two = [entry(dateKeyDaysAgo(2), "80"), entry(dateKeyDaysAgo(1), "79")];
    expect(buildWeightTrend(two).weeklyRateKg).toBeNull();
    expect(buildWeightTrend(two).currentKg).toBe(79);
  });
});

const emptyState = (): AppState => ({
  completion: {},
  top3: {},
  mechanism: {},
  schedule: [],
  supp: {},
  suppLog: {},
  mealTemplatesByDay: {},
  mealLog: {},
  supplementsList: [],
  log: [],
});

describe("recap / adherence / supplement streak", () => {
  const supps = [
    { id: "a", item: "Creatine", dose: "5g", timeAt: "08:00" },
    { id: "b", item: "D3", dose: "2000IU", timeAt: "08:00" },
  ] as unknown as Parameters<typeof supplementStreak>[1];

  it("buildYesterdayRecap returns null with no data and lists missed supps", () => {
    const state = emptyState();
    expect(buildYesterdayRecap(state, supps)).toBeNull();
    state.suppLog[dateKeyDaysAgo(1)] = { a: true };
    const recap = buildYesterdayRecap(state, supps)!;
    expect(recap.missedSupplements).toEqual(["D3"]);
  });

  it("supplementStreak counts full days and today", () => {
    const state = emptyState();
    for (let d = 0; d <= 3; d++) state.suppLog[dateKeyDaysAgo(d)] = { a: true, b: true };
    expect(supplementStreak(state, supps)).toBe(4);
    expect(supplementStreak(state, [])).toBe(0);
  });

  it("buildWeeklyAdherence returns 7 bars with percentages", () => {
    const state = emptyState();
    state.suppLog[dateKeyDaysAgo(0)] = { a: true, b: false };
    const bars = buildWeeklyAdherence(state, supps);
    expect(bars).toHaveLength(7);
    expect(bars[6].value).toBe(50);
  });

  it("scoreBarsFromHistory maps scores onto the last 7 days", () => {
    const bars = scoreBarsFromHistory([{ date: dateKeyDaysAgo(0), score: 77 }]);
    expect(bars[6].value).toBe(77);
    expect(bars[0].value).toBe(0);
  });
});
