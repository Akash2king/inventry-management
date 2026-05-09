import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "./AuthContext.jsx";
import {
  configureWorkflowNotifications,
  presentWorkflowLocalNotification,
  setAppBadgeCountSafe,
} from "./systemNotifications.js";

const POLL_MS = 60_000;
const PUSH_COOLDOWN_MS = 45_000;

/**
 * Polls unread workflow notifications and shows OS notifications when unread count increases.
 */
export function WorkflowSystemNotificationBridge() {
  const { api, user } = useAuth();
  const baseline = useRef(null);
  const lastPushAt = useRef(0);

  useEffect(() => {
    if (!api || !user) {
      baseline.current = null;
      return undefined;
    }

    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      const countRes = await api.notifications.unreadCount();
      if (cancelled || !countRes.ok) return;
      const n = Number(countRes.data?.unread_count ?? 0);
      await setAppBadgeCountSafe(n);

      if (baseline.current === null) {
        baseline.current = n;
        return;
      }

      if (n > baseline.current && n > 0) {
        const now = Date.now();
        if (now - lastPushAt.current >= PUSH_COOLDOWN_MS) {
          const listRes = await api.notifications.list({ unread: true, page_size: 1, page: 1 });
          const row =
            listRes.ok && Array.isArray(listRes.data?.results) ? listRes.data.results[0] : null;
          const title = row?.title || "Chem-Solv Inventory";
          const body =
            row?.body ||
            (n === 1 ? "New workflow notification." : `${n} unread workflow notifications.`);
          await configureWorkflowNotifications();
          await presentWorkflowLocalNotification({ title, body });
          lastPushAt.current = now;
        }
      }

      baseline.current = n;
    }

    void configureWorkflowNotifications().catch(() => {});
    void tick();

    const interval = setInterval(tick, POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void tick();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [api, user]);

  return null;
}
