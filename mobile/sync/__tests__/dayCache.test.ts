// Date-keyed day cache (Bet 1): midnight rollover with a fake clock, /today
// merge semantics, and that a refetch never erases a pending write.
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove() {} }) },
  Platform: { OS: "web" },
}));
vi.mock("expo-file-system", () => ({ File: class {}, Paths: {} }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("expo-secure-store", () => ({}));

import { todayKey } from "../../utils/storage";
import { qk } from "../queryKeys";
import {
  appStateFromExport,
  mergeToday,
  scoresFromToday,
  type TodayPayload,
} from "../serverData";
import { foldIntents } from "../applyDay";
import { latestCachedToday } from "../dayData";
import type { Intent } from "../intents";

afterEach(() => {
  vi.useRealTimers();
});

function payload(date: string, over: Partial<TodayPayload> = {}): TodayPayload {
  return Object.assign(
    {
      date,
      weekday: "Saturday",
      serverTime: `${date}T08:00:00.000Z`,
      dataEpoch: "e1",
      counts: {},
      user: { id: "u1", email: "a@b.c" },
      preferences: null,
      schedule: {
        blocks: [{ id: "b1", start: "09:00", end: "10:00", title: "Work", sortOrder: 1 }],
        completions: [
          { blockId: "b1", date, isComplete: true, hlc: "1760000000000-0000-d" },
        ],
      },
      supplements: {
        items: [{ id: "s1", item: "Creatine", dose: "5 g", timeAt: "08:00" }],
        logs: [],
      },
      meals: { templates: [], logs: [], consumed: null },
      program: {},
      workout: { sessions: [], open: null },
      dailyLog: {
        id: "l1",
        date,
        bw: "80.1",
        sleep: "",
        day: "",
        steps: "",
        top: "",
        notes: "",
      },
      score: {
        today: null,
        streak: {},
        history: [
          {
            date,
            outcomeScore: 70,
            kept: true,
            scored: true,
            routinePct: 55,
            protein: 120,
            calories: 2100,
            workoutDone: true,
            tasksDone: 2,
            tasksTotal: 4,
            suppDone: 1,
            suppTotal: 1,
            mealsDone: 2,
            mealsTotal: 3,
          },
        ],
      },
    },
    over
  ) as TodayPayload;
}

describe("date-keyed day cache", () => {
  it("rolls the query key over at local midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 23, 59, 59));
    const before = qk.today("u1", todayKey());
    vi.setSystemTime(new Date(2026, 9, 18, 0, 0, 1));
    const after = qk.today("u1", todayKey());
    expect(before).toEqual(["today", "u1", "2026-10-17"]);
    expect(after).toEqual(["today", "u1", "2026-10-18"]);
    expect(qk.today("u2", "2026-10-18")).not.toEqual(after); // per user
  });

  it("merging the new day keeps yesterday's ticks and log intact", () => {
    const day1 = mergeToday(undefined, payload("2026-10-17"));
    const day2 = mergeToday(
      day1,
      payload("2026-10-18", {
        schedule: {
          blocks: [{ id: "b1", start: "09:00", end: "10:00", title: "Work" }],
          completions: [],
        },
        dailyLog: null,
      })
    );
    expect(day2.completion["2026-10-17"]).toEqual({ b1: true });
    expect(day2.completion["2026-10-18"]).toEqual({});
    expect(day2.log.map((e) => e.date)).toEqual(["2026-10-17"]);
  });

  it("a refetch never erases a pending (unsent) write", () => {
    const pending: Intent[] = [
      {
        t: "toggle",
        kind: "supplement",
        targetId: "s1",
        date: "2026-10-17",
        value: true,
      },
      {
        t: "logFields",
        date: "2026-10-17",
        logId: "l1",
        creates: false,
        fields: { sleep: "7.5" },
      },
    ];
    const view = foldIntents(mergeToday(undefined, payload("2026-10-17")), pending);
    expect(view.suppLog["2026-10-17"]).toEqual({ s1: true });
    expect(view.log[0]).toMatchObject({ bw: "80.1", sleep: "7.5" });
  });

  it("reducers return new objects (no in-place mutation of cached state)", () => {
    const base = mergeToday(undefined, payload("2026-10-17"));
    const frozen = JSON.stringify(base);
    const next = foldIntents(base, [
      {
        t: "toggle",
        kind: "completion",
        targetId: "b1",
        date: "2026-10-17",
        value: false,
      },
    ]);
    expect(JSON.stringify(base)).toBe(frozen);
    expect(next.completion).not.toBe(base.completion);
    expect(next.completion["2026-10-17"].b1).toBe(false);
  });

  it("after midnight, the newest cached day stands in until the new one loads", () => {
    const qc = new QueryClient();
    qc.setQueryData(qk.today("u1", "2026-10-16"), payload("2026-10-16"));
    qc.setQueryData(qk.today("u1", "2026-10-17"), payload("2026-10-17"));
    qc.setQueryData(qk.today("u2", "2026-10-18"), payload("2026-10-18"));
    expect(latestCachedToday(qc, "u1")?.date).toBe("2026-10-17");
  });

  it("maps server scores to the app's history rows (score = routine %)", () => {
    const rows = scoresFromToday(payload("2026-10-17"));
    expect(rows[0]).toMatchObject({
      date: "2026-10-17",
      score: 55,
      protein: 120,
      workoutDone: true,
    });
  });

  it("builds the full history from export v2", () => {
    const s = appStateFromExport({
      scheduleBlocks: [{ id: "b1", start: "09:00", end: "10:00", title: "Work" }],
      supplements: [],
      mealTemplates: [{ id: "m1", dayOfWeek: "Monday", name: "Oats", grams: "80" }],
      mealTemplateTags: [{ mealTemplateId: "m1", label: "Protein", value: "13" }],
      completions: [{ blockId: "b1", date: "2026-10-01", isComplete: true }],
      supplementLogs: [],
      mealLogs: [{ mealTemplateId: "m1", date: "2026-10-01", isEaten: true }],
      dailyLogs: [
        { id: "a", date: "2026-10-01", bw: "81" },
        { id: "b", date: "2026-10-02", bw: "80.5" },
      ],
    });
    expect(s.completion["2026-10-01"]).toEqual({ b1: true });
    expect(s.mealTemplatesByDay.Monday[0]).toMatchObject({
      grams: 80,
      tags: [{ label: "Protein", value: "13" }],
    });
    expect(s.log.map((e) => e.date)).toEqual(["2026-10-02", "2026-10-01"]);
  });
});
