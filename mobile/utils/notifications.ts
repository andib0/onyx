import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupplementItem } from "../types/appTypes";

export type NotificationPrefs = {
  supplements: boolean;
  checkIn: boolean;
  rest: boolean;
};

const PREFS_KEY = "onyx_notification_prefs";
const DEFAULT_PREFS: NotificationPrefs = {
  supplements: false,
  checkIn: false,
  rest: true,
};

const CHECK_IN_HOUR = 20;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return Object.assign({}, DEFAULT_PREFS, JSON.parse(raw));
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function parseTime(timeAt: string): { hour: number; minute: number } | null {
  const match = String(timeAt || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

async function cancelByType(type: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.type === type)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

// Daily reminders at each supplement's time. Reschedules from scratch.
export async function syncSupplementReminders(
  enabled: boolean,
  supplements: SupplementItem[]
): Promise<void> {
  await cancelByType("supplement");
  if (!enabled) return;
  for (const supplement of supplements) {
    const time = parseTime(supplement.timeAt);
    if (!time) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: supplement.item,
        body: `${supplement.dose}${supplement.goal ? ` · ${supplement.goal}` : ""}`,
        data: { type: "supplement" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
      },
    });
  }
}

export async function syncCheckInReminder(enabled: boolean): Promise<void> {
  await cancelByType("checkin");
  if (!enabled) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Evening check-in",
      body: "Log weight, sleep and steps — 30 seconds.",
      data: { type: "checkin" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: CHECK_IN_HOUR,
      minute: 0,
    },
  });
}

// One-shot rest-end notification; fires only if the app is backgrounded
// (foreground completion is handled by the in-app timer + haptic).
export async function scheduleRestEndNotification(
  exerciseName: string,
  setNumber: number,
  secondsFromNow: number
): Promise<string | null> {
  if (secondsFromNow < 2) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rest over",
        body: `${exerciseName} — set ${setNumber}. Go.`,
        data: { type: "rest" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(secondsFromNow),
      },
    });
  } catch {
    return null;
  }
}

export async function cancelNotification(identifier: string | null): Promise<void> {
  if (!identifier) return;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
}
