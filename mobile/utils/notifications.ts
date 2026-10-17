import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupplementItem } from "../types/appTypes";
import type { PlannedReminder } from "./reminderPlan";

export type NotificationPrefs = {
  supplements: boolean;
  checkIn: boolean;
  rest: boolean;
  /** Reminder before the implementation-intention training time. */
  training: boolean;
};

const PREFS_KEY = "onyx_notification_prefs";
const DEFAULT_PREFS: NotificationPrefs = {
  supplements: false,
  checkIn: false,
  rest: true,
  training: false,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Reminders are re-planned whenever prefs change. Listeners (components/ReminderSync)
// subscribe here, so Settings doesn't need to know the day's state.
type Listener = () => void;
const listeners = new Set<Listener>();
export function onReminderPrefsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

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
  listeners.forEach((listener) => listener());
}

// Action buttons attached to notifications (lock-screen quick actions)
export const ACTION_MARK_TAKEN = "mark_taken";
export const ACTION_LOG_NOW = "log_now";

export async function registerNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync("supplement", [
      { identifier: ACTION_MARK_TAKEN, buttonTitle: "Mark all taken" },
    ]);
    await Notifications.setNotificationCategoryAsync("checkin", [
      { identifier: ACTION_LOG_NOW, buttonTitle: "Log now" },
    ]);
  } catch {
    // categories unsupported on this platform — notifications still fire
  }
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await registerNotificationCategories();
    return true;
  }
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  if (requested.granted) await registerNotificationCategories();
  return requested.granted;
}

// Legacy daily-repeating reminders (one banner per supplement at its time, fired
// even when already taken). Superseded by syncPlannedReminders; these now only
// remove the old repeating notifications so an upgraded device stops the
// simultaneous 08:00 pings. TODO(integrator): drop the syncSupplementReminders
// effect in contexts/AppStateContext.tsx — components/ReminderSync owns scheduling.
async function cancelLegacy(type: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.type === type && !n.content.data?.planned)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

export async function syncSupplementReminders(
  _enabled: boolean,
  _supplements: SupplementItem[]
): Promise<void> {
  await cancelLegacy("supplement");
}

export async function syncCheckInReminder(_enabled: boolean): Promise<void> {
  await cancelLegacy("checkin");
}

/**
 * Makes the device's scheduled one-shots equal `plan` (utils/reminderPlan): cancels
 * planned notifications that are no longer wanted (item done, pref off, time
 * changed) and legacy repeating ones; schedules the missing ones; leaves
 * unchanged ones alone (no churn on every render).
 */
export async function syncPlannedReminders(
  plan: PlannedReminder[]
): Promise<{ scheduled: number; cancelled: number }> {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const wanted = new Map(plan.map((r) => [`${r.key}@${r.fireAt.getTime()}`, r]));
  let cancelled = 0;
  for (const n of existing) {
    const data = n.content.data as { planned?: string; type?: string } | undefined;
    if (!data) continue;
    const legacy =
      !data.planned && (data.type === "supplement" || data.type === "checkin");
    if (legacy || (data.planned && !wanted.has(data.planned))) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
      cancelled++;
    } else if (data.planned) {
      wanted.delete(data.planned);
    }
  }
  let scheduled = 0;
  for (const [id, r] of wanted) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: r.title,
        body: r.body,
        data: Object.assign({}, r.data, { planned: id }),
        categoryIdentifier: r.categoryIdentifier,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt },
    });
    scheduled++;
  }
  return { scheduled, cancelled };
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
