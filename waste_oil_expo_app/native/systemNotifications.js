/**
 * Local OS notifications for workflow inbox events (mirrored emails, sign-in notices, etc.).
 * Uses expo-notifications outside Expo Go — SDK 53+ removed Android APIs from Expo Go.
 */

import { Alert, AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";

const ANDROID_CHANNEL_ID = "workflow-notifications";
const LS_PUSH_TOKEN = "wom_push_token";

function promiseNotificationRationale() {
  return new Promise((resolve) => {
    Alert.alert(
      "Turn on notifications",
      "Chem-Solv Inventory can show workflow alerts in your notification shade when the app is closed. The server sends these via Expo Push. On Android, allow unrestricted battery for this app in system settings if alerts are delayed.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
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

function resolveExpoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

function bumpNotificationsChanged() {
  if (typeof globalThis !== "undefined" && typeof globalThis.dispatchEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("wom:notifications-changed"));
  }
}

async function persistPushToken(token) {
  if (!token) {
    return;
  }
  try {
    await AsyncStorage.setItem(LS_PUSH_TOKEN, token);
  } catch {
    /* ignore */
  }
}

async function registerDeviceWithBackend(api, token) {
  if (!api?.notifications?.registerDevice || !token) {
    return;
  }
  try {
    await api.notifications.registerDevice({ token, platform: Platform.OS });
  } catch {
    /* ignore backend errors */
  }
}

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
  if (!Device.isDevice) return null;
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  try {
    await configureWorkflowNotifications();
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== "granted") {
      const go = await promiseNotificationRationale();
      if (!go) {
        return null;
      }
      const asked = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      if (asked.status !== "granted") return null;
    }

    const projectId = resolveExpoProjectId();
    if (!projectId) {
      return null;
    }

    let tokenObj = null;
    try {
      tokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
    } catch {
      tokenObj = null;
    }
    const token = tokenObj?.data || null;
    if (!token) return null;

    await persistPushToken(token);
    await registerDeviceWithBackend(api, token);
    return token;
  } catch {
    return null;
  }
}

/**
 * Expo push setup: permissions, Android channel, token registration, and listeners.
 * Returns a cleanup function.
 */
export async function startWorkflowPushRegistration(api) {
  if (!api || !isExpoPushRuntimeSupported() || !Device.isDevice) {
    return () => {};
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    return () => {};
  }

  await configureWorkflowNotifications();
  await registerWorkflowPushToken(api);

  const cleanupFns = [];

  if (typeof Notifications.addPushTokenListener === "function") {
    const tokenSub = Notifications.addPushTokenListener((event) => {
      const token = event?.data;
      if (!token) {
        return;
      }
      void persistPushToken(token);
      void registerDeviceWithBackend(api, token);
    });
    if (tokenSub && typeof tokenSub.remove === "function") {
      cleanupFns.push(() => tokenSub.remove());
    }
  }

  if (typeof Notifications.addNotificationReceivedListener === "function") {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      bumpNotificationsChanged();
    });
    if (receivedSub && typeof receivedSub.remove === "function") {
      cleanupFns.push(() => receivedSub.remove());
    }
  }

  return () => {
    cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  };
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
