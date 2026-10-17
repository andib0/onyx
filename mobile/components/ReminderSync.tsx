import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { useData } from "../contexts/DataContext";
import { useSupplements } from "../contexts/SupplementsContext";
import { useProgram } from "../contexts/ProgramContext";
import useTrainingIntention from "../hooks/ui/useTrainingIntention";
import {
  loadNotificationPrefs,
  onReminderPrefsChanged,
  syncPlannedReminders,
  type NotificationPrefs,
} from "../utils/notifications";
import { checkInDoneFor, planReminders } from "../utils/reminderPlan";

const DEBOUNCE_MS = 1500;

// Keeps scheduled reminders equal to the plan: today-and-ahead one-shots, with
// nothing for items already done (re-planned on every relevant change, so ticking
// creatine at 07:55 cancels the 08:00 banner). Renders nothing.
export default function ReminderSync() {
  const { logEntries, todayKeyValue } = useData();
  const { supplementsList, supplementLogByDate } = useSupplements();
  const { workoutCompletedToday } = useProgram();
  const intention = useTrainingIntention();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    const reload = () => {
      loadNotificationPrefs().then(setPrefs);
    };
    reload();
    return onReminderPrefsChanged(reload);
  }, []);

  const checkInDoneDates = useMemo(
    () => logEntries.filter((e) => checkInDoneFor(e)).map((e) => e.date),
    [logEntries]
  );

  useEffect(() => {
    if (!prefs || Platform.OS === "web") return undefined;
    const handle = setTimeout(() => {
      const plan = planReminders({
        now: new Date(),
        prefs: {
          supplements: prefs.supplements,
          checkIn: prefs.checkIn,
          training: prefs.training,
        },
        supplements: supplementsList,
        supplementChecksByDate: supplementLogByDate,
        checkInDoneDates,
        workoutDoneDates: workoutCompletedToday ? [todayKeyValue] : [],
        intention,
      });
      syncPlannedReminders(plan).catch(() => {});
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [
    prefs,
    supplementsList,
    supplementLogByDate,
    checkInDoneDates,
    workoutCompletedToday,
    todayKeyValue,
    intention,
  ]);

  return null;
}
