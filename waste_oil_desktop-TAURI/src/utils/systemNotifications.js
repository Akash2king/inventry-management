/**
 * OS-level toasts via the Web Notifications API (Tauri WebView2 / Chromium).
 * Shown when the window is in the background so workflow updates appear in the tray.
 */

const TAG_WORKFLOW = "chemsolv-workflow";

export function isSystemNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getSystemNotificationPermission() {
  if (!isSystemNotificationSupported()) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Must be called from a user gesture (button click) for best browser compliance.
 */
export async function requestSystemNotificationPermission() {
  if (!isSystemNotificationSupported()) {
    return "unsupported";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  if (Notification.permission === "denied") {
    return "denied";
  }
  try {
    const p = await Notification.requestPermission();
    return p;
  } catch {
    return "denied";
  }
}

/** @deprecated Use maybeShowWorkflowSystemNotification */
export function maybeShowSecuritySystemNotification(payload) {
  return maybeShowWorkflowSystemNotification(payload);
}

export function maybeShowWorkflowSystemNotification({ title, body, metadata }) {
  if (!isSystemNotificationSupported()) {
    return false;
  }
  if (Notification.permission !== "granted") {
    return false;
  }
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    return false;
  }
  try {
    const n = new Notification(title, {
      body: body || "",
      tag: TAG_WORKFLOW,
      renotify: true,
      silent: false,
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      if (metadata && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("wom:notification-click", { detail: metadata }));
      }
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
