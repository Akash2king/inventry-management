/**
 * Centralized OneSignal SDK wrapper — all direct SDK calls live here.
 * https://documentation.onesignal.com/docs/react-native-sdk-setup
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import { OneSignal, LogLevel } from "react-native-onesignal";

const DEFAULT_APP_ID = "e744024a-08b5-4703-a3ed-af0ac17e907f";

let initialized = false;
let notificationClickHandler = null;

function debugLog(label, detail) {
  if (!__DEV__) {
    return;
  }
  const msg = detail !== undefined ? `${label} ${JSON.stringify(detail)}` : label;
  console.log(`[WOM_PUSH] ${msg}`);
}

function resolveAppId() {
  return (
    Constants.expoConfig?.extra?.oneSignalAppId ||
    process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ||
    DEFAULT_APP_ID
  );
}

function bumpNotificationsChanged() {
  if (typeof globalThis !== "undefined" && typeof globalThis.dispatchEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("wom:notifications-changed"));
  }
}

export function isOneSignalRuntimeSupported() {
  return Platform.OS !== "web";
}

/** @deprecated Use isOneSignalRuntimeSupported */
export function isExpoPushRuntimeSupported() {
  return isOneSignalRuntimeSupported();
}

function setupNotificationListeners() {
  OneSignal.Notifications.addEventListener("click", (event) => {
    const data = event?.notification?.additionalData;
    if (notificationClickHandler && data && typeof data === "object") {
      notificationClickHandler(data);
    }
  });

  OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event) => {
    bumpNotificationsChanged();
    try {
      event?.getNotification?.()?.display?.();
    } catch {
      event?.notification?.display?.();
    }
  });
}

export function initializeOneSignal() {
  if (!isOneSignalRuntimeSupported() || initialized) {
    return;
  }
  if (__DEV__) {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
  }
  OneSignal.initialize(resolveAppId());
  debugLog("initialize", { appId: resolveAppId(), platform: Platform.OS });
  setupNotificationListeners();
  initialized = true;
}

export function setNotificationOpenedHandler(handler) {
  notificationClickHandler = typeof handler === "function" ? handler : null;
}

export async function syncOneSignalUser(user) {
  if (!user?.id) {
    return;
  }
  initializeOneSignal();
  OneSignal.login(String(user.id));
  debugLog("login", { externalId: String(user.id), email: user.email || null });
  const email = (user.email || "").trim();
  if (email) {
    OneSignal.User.addEmail(email);
  }
}

export async function clearOneSignalUser(api) {
  initializeOneSignal();
  try {
    const subscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
    if (subscriptionId && api?.notifications?.unregisterDevice) {
      await api.notifications.unregisterDevice(subscriptionId);
    }
  } catch {
    /* non-fatal */
  }
  OneSignal.logout();
}

export async function getPushPermissionStatus() {
  if (!isOneSignalRuntimeSupported()) {
    return "unsupported";
  }
  initializeOneSignal();
  try {
    const granted = await OneSignal.Notifications.getPermissionAsync();
    return granted ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

/** @deprecated Use getPushPermissionStatus */
export async function getWorkflowNotificationPermissionStatus() {
  return getPushPermissionStatus();
}

export async function requestPushPermission() {
  if (!isOneSignalRuntimeSupported()) {
    return { status: "unsupported" };
  }
  initializeOneSignal();
  const granted = await OneSignal.Notifications.requestPermission(true);
  return { status: granted ? "granted" : "denied" };
}

/** @deprecated Use requestPushPermission */
export async function requestWorkflowNotificationPermissions() {
  return requestPushPermission();
}

async function registerSubscriptionWithBackend(api) {
  if (!api?.notifications?.registerDevice) {
    return null;
  }
  try {
    const subscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
    if (!subscriptionId) {
      return null;
    }
    await api.notifications.registerDevice({ token: subscriptionId, platform: Platform.OS });
    debugLog("registerDevice", { subscriptionId, platform: Platform.OS });
    return subscriptionId;
  } catch {
    return null;
  }
}

export async function registerPushWithBackend(api) {
  if (!isOneSignalRuntimeSupported() || !api) {
    return null;
  }
  initializeOneSignal();
  const perm = await OneSignal.Notifications.getPermissionAsync();
  if (!perm) {
    const asked = await OneSignal.Notifications.requestPermission(true);
    if (!asked) {
      return null;
    }
  }
  return registerSubscriptionWithBackend(api);
}

/** @deprecated Use registerPushWithBackend */
export async function registerWorkflowPushToken(api) {
  return registerPushWithBackend(api);
}

/**
 * Bind OneSignal to the signed-in user and keep the subscription registered with Django.
 * Returns a cleanup function.
 */
export function startOneSignalSession(api, user) {
  const apiRef = { current: api };

  if (!api || !user || !isOneSignalRuntimeSupported()) {
    return () => {};
  }

  initializeOneSignal();

  void (async () => {
    await syncOneSignalUser(user);
    await registerPushWithBackend(api);
  })();

  const subscriptionListener = OneSignal.User.pushSubscription.addEventListener("change", () => {
    void registerSubscriptionWithBackend(apiRef.current);
  });

  return () => {
    try {
      subscriptionListener?.remove?.();
    } catch {
      /* ignore */
    }
  };
}

/** @deprecated Use startOneSignalSession */
export async function startWorkflowPushRegistration(api) {
  return () => {};
}

/** @deprecated Use clearOneSignalUser */
export async function unregisterWorkflowPushToken(api) {
  await clearOneSignalUser(api);
  return null;
}

export async function setAppBadgeCountSafe(_count) {
  /* Badge counts are managed by OneSignal / OS when remote pushes arrive. */
}

export async function configureWorkflowNotifications() {
  initializeOneSignal();
}

export async function presentWorkflowLocalNotification(_payload) {
  /* Remote pushes are delivered by OneSignal; no local fallback. */
}
