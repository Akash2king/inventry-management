/**
 * Local OS notifications for workflow inbox events (mirrored emails, sign-in notices, etc.).
 * Uses expo-notifications outside Expo Go — SDK 53+ removed Android APIs from Expo Go.
 */

import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";

const ANDROID_CHANNEL_ID = "workflow-notifications";
const LS_PUSH_TOKEN = "wom_push_token";

function getExpoProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null
  );
}

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
      sound: "default",
      vibrationPattern: [0, 220, 80, 220],
      enableVibrate: true,
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

/**
 * Register device push token with backend so server can send remote push notifications.
 * Returns the token string or null.
 */
export async function registerWorkflowPushToken(api) {
  if (!isExpoPushRuntimeSupported()) return null;
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  try {
    await configureWorkflowNotifications();
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      if (asked.status !== "granted") return null;
    }

    // Expo push token (suitable for Expo push service) or device push token
    let tokenObj = null;
    try {
      const projectId = getExpoProjectId();
      tokenObj = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
    } catch (e) {
      try {
        tokenObj = await Notifications.getDevicePushTokenAsync();
      } catch (err) {
        tokenObj = null;
      }
    }
    const token = tokenObj?.data || tokenObj?.token || null;
    if (!token) return null;

    // persist locally
    try {
      await AsyncStorage.setItem(LS_PUSH_TOKEN, token);
    } catch {}

    // Send to backend if API provided
    try {
      if (api && api.notifications && typeof api.notifications.registerDevice === "function") {
        await api.notifications.registerDevice({ token, platform: Platform.OS });
      }
    } catch (e) {
      /* ignore backend errors */
    }

    return token;
  } catch (e) {
    return null;
  }
}

export async function unregisterWorkflowPushToken(api) {
  try {
    const token = await AsyncStorage.getItem(LS_PUSH_TOKEN);
    if (!token) return null;
    try {
      if (api && api.notifications) {
        if (typeof api.notifications.unregisterDevice === "function") {
          await api.notifications.unregisterDevice(token);
        } else if (typeof api.notifications.registerDevice === "function") {
          // fallback: attempt POST /devices/ with intention to delete (some servers support method override)
          await api.notifications.registerDevice({ token, _delete: true });
        }
      }
    } catch {}
    try {
      await AsyncStorage.removeItem(LS_PUSH_TOKEN);
    } catch {}
    return token;
  } catch {
    return null;
  }
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
