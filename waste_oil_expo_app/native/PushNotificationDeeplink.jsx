import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext.jsx";
import { navigationRef } from "./navigationRef.js";

function navigateFromPushData(data) {
  if (!navigationRef.isReady()) {
    return;
  }
  const d = data && typeof data === "object" ? data : {};
  const screen = d.screen;
  try {
    if (screen === "RecordDetail" && d.recordId) {
      navigationRef.navigate("RecordDetail", {
        recordId: d.recordId,
        title: d.recordTitle || d.titleParam || "Record",
      });
    } else if (screen === "GmConsole") {
      navigationRef.navigate("GmConsole");
    } else {
      navigationRef.navigate("InAppNotifications");
    }
  } catch {
    /* stack may not include screen for this user (e.g. must_change_password) */
  }
}

/**
 * When the user taps a remote (Expo) push, open the matching stack screen.
 * Relies on `data` from the backend (`expo_push.expo_push_data_for_navigation`).
 */
export function PushNotificationDeeplink() {
  const { isAuthenticated } = useAuth();
  const coldStartHandled = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web" || !isAuthenticated) {
      return undefined;
    }

    let subscription = null;
    let cancelled = false;

    void (async () => {
      const Notifications = await import("expo-notifications");
      if (cancelled) {
        return;
      }

      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data;
        navigateFromPushData(data || {});
      });

      if (!coldStartHandled.current) {
        coldStartHandled.current = true;
        try {
          const last = await Notifications.getLastNotificationResponseAsync();
          const data = last?.notification?.request?.content?.data;
          if (data && typeof data === "object" && Object.keys(data).length > 0) {
            setTimeout(() => navigateFromPushData(data), 500);
          }
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [isAuthenticated]);

  return null;
}
