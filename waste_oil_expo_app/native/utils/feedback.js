import { Platform } from "react-native";
import { useUiStore } from "../../src/store/uiStore.js";

let Haptics = null;
try {
  Haptics = require("expo-haptics");
} catch {
  /* optional */
}

function haptic(type) {
  if (!Haptics) return;
  try {
    if (type === "success") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === "error") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    /* ignore */
  }
}

export function showToast(message, type = "success") {
  const text = String(message || "").trim();
  if (!text) return;
  haptic(type === "error" ? "error" : "success");
  useUiStore.getState().showToast(text, type);
}

export function showSuccess(message) {
  showToast(message, "success");
}

export function showError(message) {
  showToast(message, "error");
}

/**
 * Branded alert with one or more actions (replaces Alert.alert).
 * @param {string} title
 * @param {string} [message]
 * @param {Array<{ text: string, style?: 'default'|'cancel'|'destructive', onPress?: () => void }>} [buttons]
 * @param {{ variant?: string, icon?: string, cancelable?: boolean }} [opts]
 */
export function showAlert(title, message, buttons, opts = {}) {
  const btns =
    buttons && buttons.length
      ? buttons
      : [{ text: "OK", style: "default" }];
  useUiStore.getState().showDialog({
    title,
    message: message || "",
    buttons: btns,
    variant: opts.variant || "default",
    icon: opts.icon,
    cancelable: opts.cancelable,
  });
}

/** Confirm / destructive action with Cancel + primary button. */
export function showConfirm({
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  destructive = false,
  icon,
  onConfirm,
  onCancel,
}) {
  haptic("light");
  useUiStore.getState().showDialog({
    title,
    message: message || "",
    variant: destructive ? "danger" : "default",
    icon: icon || (destructive ? "log-out-outline" : undefined),
    buttons: [
      { text: cancelText, style: "cancel", onPress: onCancel },
      { text: confirmText, style: destructive ? "destructive" : "default", onPress: onConfirm },
    ],
  });
}

/** @deprecated Prefer showConfirm */
export function confirmAlert(title, message, onConfirm) {
  showConfirm({ title, message, confirmText: "OK", onConfirm });
}

export function showBlockingError(title, message) {
  if (Platform.OS === "web") {
    showError(message || title);
    return;
  }
  showAlert(title, message || title, [{ text: "OK", style: "default" }], {
    variant: "warning",
    icon: "alert-circle-outline",
  });
}

export function showInfo(title, message, onAction) {
  showAlert(
    title,
    message,
    onAction
      ? [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", style: "default", onPress: onAction },
        ]
      : [{ text: "OK", style: "default" }],
    { variant: "default", icon: "information-circle-outline" },
  );
}
