import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildAchievementCtx,
  detectNewUnlocks,
  evaluateAchievements,
} from "../achievements";
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

const log = (bw: string): LogEntry => ({
  date: "2026-10-01",
  day: "",
  bw,
  sleep: "",
  steps: "",
  top: "",
  notes: "",
});

describe("buildAchievementCtx", () => {
  it("counts tracked, perfect, trained days and weigh-ins; best run respects gaps", () => {
    const history = [
      row("2026-10-01", 90, true),
      row("2026-10-02", 100, true),
      row("2026-10-03", 85),
      // 10-04 missing → run breaks
      row("2026-10-05", 95),
      row("2026-10-06", 40),
      row("2026-10-07", 100, true),
    ];
    const ctx = buildAchievementCtx(history, [log("80"), log(""), log(" 79.5 ")], 2);
    expect(ctx).toEqual({
      daysTracked: 6,
      currentStreak: 2,
      bestStreak: 3,
      perfectDays: 2,
      daysTrained: 3,
      weightLogs: 2,
    });
  });

  it("best streak is at least the current streak", () => {
    expect(buildAchievementCtx([], [], 5).bestStreak).toBe(5);
  });
});

describe("evaluateAchievements", () => {
  it("caps progress at the target and flags unlocks", () => {
    const list = evaluateAchievements({
      daysTracked: 8,
      currentStreak: 0,
      bestStreak: 3,
      perfectDays: 0,
      daysTrained: 12,
      weightLogs: 0,
    });
    const byId = Object.fromEntries(list.map((a) => [a.id, a]));
    expect(byId.first_day).toMatchObject({ unlocked: true, progress: 1 });
    expect(byId.week_tracked.unlocked).toBe(true);
    expect(byId.month_tracked).toMatchObject({ unlocked: false, progress: 8 });
    expect(byId.streak_3.unlocked).toBe(true);
    expect(byId.streak_7.unlocked).toBe(false);
    expect(byId.gym_10.unlocked).toBe(true);
    expect(byId.perfect_day.unlocked).toBe(false);
  });
});

describe("detectNewUnlocks (AsyncStorage mocked)", () => {
  beforeEach(() => store.clear());

  it("returns only unseen ids and persists the union", async () => {
    expect(await detectNewUnlocks(["a", "b"])).toEqual(["a", "b"]);
    expect(await detectNewUnlocks(["a", "b", "c"])).toEqual(["c"]);
    expect(JSON.parse(store.get("onyx_achievements_seen")!)).toEqual(["a", "b", "c"]);
    expect(await detectNewUnlocks(["a"])).toEqual([]);
  });

  it("storage failure → no unlocks, no throw", async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("disk"));
    expect(await detectNewUnlocks(["x"])).toEqual([]);
  });
});
