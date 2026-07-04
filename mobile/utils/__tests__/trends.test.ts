import { describe, expect, it } from "vitest";
import { dateKeyDaysAgo, scoreStreak, last7Bars } from "../trends";

describe("dateKeyDaysAgo", () => {
  it("returns today for 0", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(dateKeyDaysAgo(0)).toBe(expected);
  });
});

describe("scoreStreak", () => {
  const today = dateKeyDaysAgo(0);

  it("counts consecutive qualifying days including today", () => {
    const history = [
      { date: dateKeyDaysAgo(1), score: 90 },
      { date: dateKeyDaysAgo(2), score: 85 },
      { date: dateKeyDaysAgo(3), score: 40 }, // breaks streak
      { date: dateKeyDaysAgo(4), score: 95 },
    ];
    expect(scoreStreak(history, today, 88)).toBe(3);
  });

  it("starts from yesterday when today does not qualify yet", () => {
    const history = [
      { date: dateKeyDaysAgo(1), score: 90 },
      { date: dateKeyDaysAgo(2), score: 90 },
    ];
    expect(scoreStreak(history, today, 10)).toBe(2);
  });

  it("returns 0 with no qualifying days", () => {
    expect(scoreStreak([], today, 0)).toBe(0);
  });

  it("live today score overrides a snapshotted one", () => {
    const history = [{ date: today, score: 100 }];
    expect(scoreStreak(history, today, 20)).toBe(0);
  });
});

describe("last7Bars", () => {
  it("returns 7 bars oldest to newest with 0 for missing days", () => {
    const history = [{ date: dateKeyDaysAgo(0), score: 75 }];
    const bars = last7Bars(history, (r) => r.score);
    expect(bars).toHaveLength(7);
    expect(bars[6].value).toBe(75);
    expect(bars[0].value).toBe(0);
  });
});
