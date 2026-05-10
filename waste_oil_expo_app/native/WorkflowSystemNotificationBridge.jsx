import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "./AuthContext.jsx";
import {
  configureWorkflowNotifications,
  presentWorkflowLocalNotification,
  setAppBadgeCountSafe,
} from "./systemNotifications.js";
import { registerWorkflowPushToken } from "./systemNotifications.js";

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
    // Register push token with backend so server can send remote pushes when app is closed.
    // Re-register on mount and when app becomes active to refresh tokens when needed.
    const doRegister = async () => {
      try {
        await registerWorkflowPushToken(api);
      } catch {}
    };
    void doRegister();
    void tick();

    const interval = setInterval(tick, POLL_MS);
    // Re-run tick and re-register token when app becomes active.
    const onAppState = (state) => {
      if (state === "active") {
        void tick();
        void doRegister();
      }
    };
    const sub = AppState.addEventListener("change", onAppState);

    // Periodically refresh token every 6 hours as a best-effort
    const REFRESH_TOKEN_MS = 6 * 60 * 60 * 1000;
    const refreshInterval = setInterval(() => void doRegister(), REFRESH_TOKEN_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(refreshInterval);
      sub.remove();
    };
  }, [api, user]);

  return null;
}
