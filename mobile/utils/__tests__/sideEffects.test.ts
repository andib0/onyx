// Side-effect modules with their native dependencies mocked:
// haptics (expo-haptics), storage + recentFoods (AsyncStorage),
// notifications (expo-notifications + AsyncStorage).
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn(async (k: string) => void store.delete(k)),
    multiRemove: vi.fn(async (keys: string[]) => keys.forEach((k) => store.delete(k))),
  },
}));

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => {}),
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

const scheduled: Array<{ identifier: string; content: { data?: { type?: string } } }> =
  [];
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  setNotificationCategoryAsync: vi.fn(async () => {}),
  getPermissionsAsync: vi.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
  getAllScheduledNotificationsAsync: vi.fn(async () => scheduled.slice()),
  cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
    const i = scheduled.findIndex((n) => n.identifier === id);
    if (i >= 0) scheduled.splice(i, 1);
  }),
  scheduleNotificationAsync: vi.fn(
    async (req: { content: { data?: { type?: string } } }) => {
      const identifier = `n${scheduled.length + 1}_${Math.random()}`;
      scheduled.push({ identifier, content: req.content });
      return identifier;
    }
  ),
  SchedulableTriggerInputTypes: { DAILY: "daily", TIME_INTERVAL: "timeInterval" },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { confirm, success, tap, warn } from "../haptics";
import { clearStorage, ensureState, todayKey } from "../storage";
import { getRecentFoods, pushRecentFood } from "../recentFoods";
import {
  cancelNotification,
  ensurePermission,
  loadNotificationPrefs,
  saveNotificationPrefs,
  scheduleRestEndNotification,
  syncCheckInReminder,
  syncSupplementReminders,
} from "../notifications";
import type { Food } from "../../api/foods";

beforeEach(() => {
  store.clear();
  scheduled.length = 0;
  vi.clearAllMocks();
});

describe("haptics", () => {
  it("maps the four verbs to expo-haptics calls", () => {
    tap();
    confirm();
    success();
    warn();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning");
  });
  it("swallows native failures (web / unsupported devices)", async () => {
    vi.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error("nope"));
    expect(() => tap()).not.toThrow();
    await Promise.resolve();
  });
});

describe("storage", () => {
  it("todayKey is the local YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 23, 59));
    expect(todayKey()).toBe("2026-01-05");
    vi.useRealTimers();
  });
  it("ensureState fills defaults and keeps arrays", () => {
    const s = ensureState({ schedule: "bad" as never, log: [] });
    expect(s.schedule).toEqual([]);
    expect(s.completion).toEqual({});
    expect(s.supplementsList).toEqual([]);
  });
  it("clearStorage removes the legacy cache keys", async () => {
    store.set("andi_weekday_os_v1", "{}");
    store.set("andi_weekday_os_prefs_v1", "{}");
    store.set("other", "1");
    await clearStorage();
    expect(Array.from(store.keys())).toEqual(["other"]);
  });
});

describe("recentFoods", () => {
  const food = (id: string): Food => ({
    id,
    name: id,
    brand: null,
    caloriesPer100g: 100,
    proteinPer100g: 10,
    carbsPer100g: 10,
    fatPer100g: 1,
    fiberPer100g: null,
    sugarPer100g: null,
    sodiumMgPer100g: null,
    isVerified: true,
  });

  it("most recent first, de-duplicated, capped at 8", async () => {
    for (let i = 0; i < 10; i++) await pushRecentFood(food(`f${i}`));
    const after = await pushRecentFood(food("f3"));
    expect(after[0].id).toBe("f3");
    expect(after).toHaveLength(8);
    expect(new Set(after.map((f) => f.id)).size).toBe(8);
    expect((await getRecentFoods()).map((f) => f.id)).toEqual(after.map((f) => f.id));
  });

  it("corrupt or failing storage degrades to an empty list", async () => {
    store.set("onyx_recent_foods_v1", "{not json");
    expect(await getRecentFoods()).toEqual([]);
    store.set("onyx_recent_foods_v1", JSON.stringify({ not: "array" }));
    expect(await getRecentFoods()).toEqual([]);
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("full"));
    await expect(pushRecentFood(food("x"))).resolves.toHaveLength(1);
  });
});

describe("notifications", () => {
  it("prefs default, persist and merge", async () => {
    expect(await loadNotificationPrefs()).toEqual({
      supplements: false,
      checkIn: false,
      rest: true,
    });
    await saveNotificationPrefs({ supplements: true, checkIn: false, rest: false });
    expect(await loadNotificationPrefs()).toEqual({
      supplements: true,
      checkIn: false,
      rest: false,
    });
  });

  it("asks for permission once and registers action categories", async () => {
    expect(await ensurePermission()).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledTimes(2);
  });

  it("supplement reminders reschedule from scratch, skip bad times", async () => {
    const supps = [
      { id: "a", item: "Creatine", goal: "", dose: "5g", timeAt: "08:00" },
      { id: "b", item: "Magnesium", goal: "sleep", dose: "400mg", timeAt: "22:15" },
      { id: "c", item: "Broken", goal: "", dose: "", timeAt: "25:99" },
    ];
    await syncSupplementReminders(true, supps);
    await syncSupplementReminders(true, supps);
    expect(scheduled.filter((n) => n.content.data?.type === "supplement")).toHaveLength(
      2
    );
    await syncSupplementReminders(false, supps);
    expect(scheduled).toHaveLength(0);
  });

  it("check-in reminder is a single daily notification", async () => {
    await syncCheckInReminder(true);
    await syncCheckInReminder(true);
    expect(scheduled.filter((n) => n.content.data?.type === "checkin")).toHaveLength(1);
  });

  it("rest-end: none under 2 s, cancellable otherwise", async () => {
    expect(await scheduleRestEndNotification("Bench", 2, 1)).toBeNull();
    const id = await scheduleRestEndNotification("Bench", 2, 90);
    expect(id).not.toBeNull();
    await cancelNotification(id);
    expect(scheduled).toHaveLength(0);
    await expect(cancelNotification(null)).resolves.toBeUndefined();
  });
});
