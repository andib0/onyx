import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useSupplements } from "../contexts/SupplementsContext";
import {
  ACTION_MARK_TAKEN,
  ACTION_LOG_NOW,
  registerNotificationCategories,
} from "../utils/notifications";

// Handles lock-screen notification action buttons. Renders nothing.
export default function NotificationResponder() {
  const router = useRouter();
  const { setSupplementChecked } = useSupplements();

  useEffect(() => {
    registerNotificationCategories().catch(() => {});
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      const data = response.notification.request.content.data as {
        supplementId?: string;
      };
      if (action === ACTION_MARK_TAKEN && data?.supplementId) {
        setSupplementChecked(data.supplementId, true).catch(() => {});
      } else if (action === ACTION_LOG_NOW) {
        router.push("/(tabs)/focus");
      }
    });
    return () => sub.remove();
  }, [router, setSupplementChecked]);

  return null;
}
