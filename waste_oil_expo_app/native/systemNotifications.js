/**
 * Local OS notifications for workflow inbox events (mirrored emails, sign-in notices, etc.).
 * Uses expo-notifications outside Expo Go — SDK 53+ removed Android APIs from Expo Go.
 */

import { AppState, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

const ANDROID_CHANNEL_ID = "workflow-notifications";

/** Expo Go cannot load expo-notifications on Android (SDK 53+). */
export function isExpoPushRuntimeSupported() {
  if (Platform.OS === "web") {
    return false;
  }
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

let notificationsPromise = null;
let handlerRegistered = false;

async function getNotifications() {
  if (!isExpoPushRuntimeSupported()) {
    return null;
  }
  if (!notificationsPromise) {
    notificationsPromise = import("expo-notifications");
  }
  return notificationsPromise;
}

export async function configureWorkflowNotifications() {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }
  if (handlerRegistered) {
    return;
  }
  handlerRegistered = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const inBackground = AppState.currentState !== "active";
      return {
        shouldShowAlert: inBackground,
        shouldPlaySound: inBackground,
        shouldSetBadge: true,
      };
    },
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Workflow notifications",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: [0, 220, 80, 220],
    });
  }
}

export async function getWorkflowNotificationPermissionStatus() {
  if (!isExpoPushRuntimeSupported()) {
    return "expo_go";
  }
  const Notifications = await getNotifications();
  if (!Notifications) {
    return "unsupported";
  }
  const p = await Notifications.getPermissionsAsync();
  return p.status;
}

export async function requestWorkflowNotificationPermissions() {
  if (!isExpoPushRuntimeSupported()) {
    return { status: "expo_go" };
  }
  const Notifications = await getNotifications();
  if (!Notifications) {
    return { status: "unsupported" };
  }
  await configureWorkflowNotifications();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") {
    return { status: "granted" };
  }
  const asked = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return { status: asked.status };
}

export async function presentWorkflowLocalNotification({ title, body }) {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") {
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: body || "",
      sound: Platform.OS === "android" ? "default" : true,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

export async function setAppBadgeCountSafe(count) {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }
  try {
    const n = Math.max(0, Math.min(999, Number(count) || 0));
    await Notifications.setBadgeCountAsync(n);
  } catch {
    /* launcher may not support badges */
  }
}

/** @deprecated Use configureWorkflowNotifications */
export async function configureSecurityNotifications() {
  return configureWorkflowNotifications();
}
/** @deprecated Use getWorkflowNotificationPermissionStatus */
export async function getSecurityNotificationPermissionStatus() {
  return getWorkflowNotificationPermissionStatus();
}
/** @deprecated Use requestWorkflowNotificationPermissions */
export async function requestSecurityNotificationPermissions() {
  return requestWorkflowNotificationPermissions();
}
/** @deprecated Use presentWorkflowLocalNotification */
export async function presentSecurityLocalNotification(payload) {
  return presentWorkflowLocalNotification(payload);
}
