import * as Haptics from "expo-haptics";

// One vocabulary, four verbs. Never more than one per gesture.

// Checks, chips, steppers, pickers
export function tap(): void {
  Haptics.selectionAsync().catch(() => {});
}

// Buttons, set done, saves
export function confirm(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// Workout complete, PR, perfect day
export function success(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// Caffeine cutoff, over target
export function warn(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
