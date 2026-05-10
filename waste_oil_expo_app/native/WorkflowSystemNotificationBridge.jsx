import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext.jsx";
import {
  configureWorkflowNotifications,
  presentWorkflowLocalNotification,
  setAppBadgeCountSafe,
} from "./systemNotifications.js";

const POLL_MS = 60_000;
const PUSH_COOLDOWN_MS = 45_000;
const LAST_LOCAL_NOTIFICATION_ID = "wom_last_local_notification_id";

/**
 * Polls unread workflow notifications and shows OS notifications when unread count increases.
 */
export function WorkflowSystemNotificationBridge() {
  const { api, user } = useAuth();
  const baseline = useRef(null);
  const lastPushAt = useRef(0);
  const lastNotifiedId = useRef(null);

  useEffect(() => {
    if (!api || !user) {
      baseline.current = null;
      lastNotifiedId.current = null;
      return undefined;
    }

    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      const countRes = await api.notifications.unreadCount();
      if (cancelled || !countRes.ok) return;
      const n = Number(countRes.data?.unread_count ?? 0);
      await setAppBadgeCountSafe(n);

      const listRes = n > 0 ? await api.notifications.list({ unread: true, page_size: 1, page: 1 }) : null;
      const row = listRes?.ok && Array.isArray(listRes.data?.results) ? listRes.data.results[0] : null;
      const newestId = row?.id ? String(row.id) : null;
      const storedLastId = await AsyncStorage.getItem(LAST_LOCAL_NOTIFICATION_ID);

      if (baseline.current === null) {
        baseline.current = n;
        if (newestId && storedLastId !== newestId) {
          const title = row?.title || "Chem-Solv Inventory";
          const body = row?.body || "New workflow notification.";
          await configureWorkflowNotifications();
          await presentWorkflowLocalNotification({ title, body });
          lastNotifiedId.current = newestId;
          await AsyncStorage.setItem(LAST_LOCAL_NOTIFICATION_ID, newestId);
        }
        return;
      }

      if (n > baseline.current && n > 0) {
        const now = Date.now();
        if (now - lastPushAt.current >= PUSH_COOLDOWN_MS) {
          const title = row?.title || "Chem-Solv Inventory";
          const body =
            row?.body ||
            (n === 1 ? "New workflow notification." : `${n} unread workflow notifications.`);
          await configureWorkflowNotifications();
          await presentWorkflowLocalNotification({ title, body });
          lastPushAt.current = now;
          if (newestId) {
            lastNotifiedId.current = newestId;
            await AsyncStorage.setItem(LAST_LOCAL_NOTIFICATION_ID, newestId);
          }
        }
      }

      baseline.current = n;
    }

    void configureWorkflowNotifications().catch(() => {});
    void tick();

    const interval = setInterval(tick, POLL_MS);
    const onAppState = (state) => {
      if (state === "active") {
        void tick();
      }
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [api, user]);

  return null;
}
