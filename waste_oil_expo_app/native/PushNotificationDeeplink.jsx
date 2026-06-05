import React, { useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext.jsx";
import { navigationRef } from "./navigationRef.js";
import { initializeOneSignal, setNotificationOpenedHandler } from "./oneSignalService.js";

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
 * When the user taps a OneSignal push, open the matching stack screen.
 * Relies on `data` from the backend (`onesignal_push.push_data_for_navigation`).
 */
export function PushNotificationDeeplink() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (Platform.OS === "web" || !isAuthenticated) {
      return undefined;
    }

    initializeOneSignal();
    setNotificationOpenedHandler((data) => {
      navigateFromPushData(data);
    });

    return () => {
      setNotificationOpenedHandler(null);
    };
  }, [isAuthenticated]);

  return null;
}
