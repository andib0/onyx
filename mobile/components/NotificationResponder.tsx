import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useSupplements } from "../contexts/SupplementsContext";
import {
  ACTION_MARK_TAKEN,
  ACTION_LOG_NOW,
  registerNotificationCategories,
} from "../utils/notifications";

type ReminderData = {
  type?: string;
  supplementId?: string; // legacy per-supplement reminders
  supplementIds?: string[]; // one banner per time slot
};

// Handles notification taps and lock-screen action buttons. Renders nothing.
export default function NotificationResponder() {
  const router = useRouter();
  const { setSupplementChecked } = useSupplements();

  useEffect(() => {
    registerNotificationCategories().catch(() => {});
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      const data = (response.notification.request.content.data || {}) as ReminderData;
      if (action === ACTION_MARK_TAKEN) {
        const ids = data.supplementIds?.length
          ? data.supplementIds
          : data.supplementId
            ? [data.supplementId]
            : [];
        for (const id of ids) setSupplementChecked(id, true).catch(() => {});
        return;
      }
      if (action === ACTION_LOG_NOW || data.type === "checkin") {
        router.push("/(tabs)/today");
      } else if (data.type === "training") {
        router.push("/(tabs)/train");
      } else if (data.type === "supplement") {
        router.push("/(tabs)/today");
      }
    });
    return () => sub.remove();
  }, [router, setSupplementChecked]);

  return null;
}
