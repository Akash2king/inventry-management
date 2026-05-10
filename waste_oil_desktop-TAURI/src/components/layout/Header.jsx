import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { useUiStore } from "@/store/uiStore.js";
import { ToastContainer } from "@/components/ui/ToastContainer.jsx";
import { maybeShowWorkflowSystemNotification } from "@/utils/systemNotifications.js";

const PUSH_COOLDOWN_MS = 45_000;

function initials(user) {
  const n = user?.full_name || user?.username || "?";
  const parts = String(n).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return n.slice(0, 2).toUpperCase();
}

export function Header() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const bumpPageRefresh = useUiStore((s) => s.bumpPageRefresh);
  const [unread, setUnread] = useState(null);
  const prevUnreadRef = useRef(null);
  const lastPushAtRef = useRef(0);

  const fetchUnreadAndMaybeNotify = useCallback(async () => {
    if (!token || !window.api?.notifications?.unreadCount) {
      setUnread(null);
      prevUnreadRef.current = null;
      return;
    }
    const res = await window.api.notifications.unreadCount(token);
    if (!res?.ok) return;
    const n = Number(res.data?.unread_count ?? 0);
    const prev = prevUnreadRef.current;
    if (prev !== null && n > prev && n > 0) {
      const now = Date.now();
      if (
        now - lastPushAtRef.current >= PUSH_COOLDOWN_MS &&
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        let title = "Chem-Solv Inventory";
        let body = n === 1 ? "New workflow notification." : `${n} unread workflow notifications.`;
        if (window.api.notifications.list) {
          const listRes = await window.api.notifications.list(
            { unread: true, page_size: 1, page: 1 },
            token,
          );
          if (listRes?.ok && Array.isArray(listRes.data?.results) && listRes.data.results[0]) {
            const row = listRes.data.results[0];
            title = row.title || title;
            body = row.body || body;
          }
        }
        if (maybeShowWorkflowSystemNotification({ title, body })) {
          lastPushAtRef.current = now;
        }
      }
    }
    prevUnreadRef.current = n;
    setUnread(n);
  }, [token]);

  useEffect(() => {
    if (!token || !window.api?.notifications?.unreadCount) {
      setUnread(null);
      prevUnreadRef.current = null;
      return undefined;
    }
    void fetchUnreadAndMaybeNotify();
    const id = setInterval(fetchUnreadAndMaybeNotify, 60_000);
    return () => clearInterval(id);
  }, [token, fetchUnreadAndMaybeNotify]);

  useEffect(() => {
    const onBump = () => {
      void fetchUnreadAndMaybeNotify();
    };
    window.addEventListener("wom:notifications-changed", onBump);
    return () => window.removeEventListener("wom:notifications-changed", onBump);
  }, [fetchUnreadAndMaybeNotify]);

  return (
    <header className="header-bar">
      <div className="header-bar__brand">
        <h1>Chem-Solv Inventory</h1>
        <ToastContainer />
      </div>
      <div className="header-user">
        <button
          type="button"
          className="btn btn-ghost btn-sm header-refresh"
          title="Reload data for this page"
          aria-label="Refresh page data"
          onClick={() => bumpPageRefresh()}
        >
          Refresh
        </button>
        <div className="header-user__meta">
          <span className="header-user__name">{user?.full_name || user?.username || "User"}</span>
          <span className="header-user__role">
            {user?.username ? `@${user.username}` : ""}
            {user?.role ? (user?.username ? ` • ${user.role}` : user.role) : ""}
          </span>
        </div>
        <div className="header-user__avatar" aria-hidden>
          {initials(user)}
        </div>
        <Link
          to="/notifications"
          className="btn btn-ghost btn-sm"
          title={
            (unread ?? 0) > 0 ? `${unread} unread workflow notifications` : "Workflow notifications"
          }
          aria-label={
            (unread ?? 0) > 0 ? `Alerts, ${unread} unread` : "Alerts"
          }
        >
          Alerts
          {unread != null && unread > 0 ? (
            <span
              style={{
                marginLeft: 6,
                background: "rgba(239, 68, 68, 0.95)",
                color: "#fff",
                borderRadius: 999,
                fontSize: "0.72rem",
                padding: "1px 6px",
                fontWeight: 700,
                minWidth: "1.35rem",
                display: "inline-block",
                textAlign: "center",
              }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Link>
        <Link to="/change-password" className="btn btn-ghost btn-sm" title="Change your password">
          Password
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => logout()}>
          Logout
        </button>
      </div>
    </header>
  );
}
