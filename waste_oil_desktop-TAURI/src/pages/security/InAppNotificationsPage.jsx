import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import * as notifApi from "@/api/inAppNotifications.js";
import {
  getSystemNotificationPermission,
  isSystemNotificationSupported,
  requestSystemNotificationPermission,
} from "@/utils/systemNotifications.js";

function formatTs(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function bumpHeaderUnreadBadge() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wom:notifications-changed"));
  }
}

export function InAppNotificationsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const canBroadcast = user?.role === "manager" || user?.role === "gm" || user?.role === "superadmin";

  useEffect(() => {
    if (!isSystemNotificationSupported()) {
      setPushStatus("unsupported");
      return;
    }
    setPushStatus(getSystemNotificationPermission());
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [data, unreadPayload] = await Promise.all([
        notifApi.listNotifications({ unread: onlyUnread }, token),
        notifApi.unreadCount(token).catch(() => ({ unread_count: 0 })),
      ]);
      setRows(Array.isArray(data?.results) ? data.results : []);
      setUnreadTotal(Number(unreadPayload?.unread_count ?? 0));
    } catch (e) {
      setError(e?.message || "Could not load notifications");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, onlyUnread]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onMarkRead(id) {
    if (!token) return;
    setError("");
    try {
      await notifApi.markRead(id, token);
      await load();
      bumpHeaderUnreadBadge();
    } catch (e) {
      setError(e?.message || "Could not update");
    }
  }

  async function onMarkAll() {
    if (!token || unreadTotal <= 0) return;
    setError("");
    try {
      await notifApi.markAllRead(token);
      await load();
      bumpHeaderUnreadBadge();
    } catch (e) {
      setError(e?.message || "Could not update");
    }
  }

  async function onBroadcast() {
    if (!token || !canBroadcast) return;
    const title = broadcastTitle.trim();
    const body = broadcastBody.trim();
    if (!title) return;
    setBroadcastBusy(true);
    setError("");
    try {
      const res = await notifApi.broadcastNotification({ title, body }, token);
      if (!res?.ok) {
        throw new Error(res?.error || "Could not send notification");
      }
      setBroadcastTitle("");
      setBroadcastBody("");
      await load();
    } catch (e) {
      setError(e?.message || "Could not send notification");
    } finally {
      setBroadcastBusy(false);
    }
  }

  return (
    <div>
      <div className="page-records__head">
        <h2 className="page-records__title" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.5rem" }}>
          <span>Workflow notifications</span>
          {!loading ? (
            unreadTotal > 0 ? (
              <span
                className="badge-completed"
                style={{
                  textTransform: "none",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
                title={`${unreadTotal} unread`}
              >
                {unreadTotal} unread
              </span>
            ) : (
              <span style={{ fontSize: "0.88rem", fontWeight: 500, opacity: 0.55 }}>(all caught up)</span>
            )
          ) : (
            <span style={{ fontSize: "0.88rem", fontWeight: 500, opacity: 0.45 }}>Loading…</span>
          )}
        </h2>
        <p style={{ margin: 0, opacity: 0.85, maxWidth: "52rem" }}>
          Record forwarding, returns, completions, SLA notices, welcomes, and monthly reports — same copy as email when
          applicable.{" "}
          <Link to="/sessions" style={{ fontWeight: 600 }}>
            Signed-in devices (read-only)
          </Link>
        </p>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        {error ? (
          <div className="login-error" role="alert" style={{ marginBottom: "0.75rem" }}>
            {error}
          </div>
        ) : null}

        {pushStatus === "unsupported" ? (
          <p style={{ fontSize: "0.88rem", opacity: 0.8, marginBottom: "1rem" }}>
            Browser / WebView notifications are not available in this environment.
          </p>
        ) : (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "10px",
              border: "1px solid rgba(15,23,42,0.12)",
              background: "rgba(59, 130, 246, 0.05)",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <div style={{ flex: "1 1 220px", fontSize: "0.9rem", lineHeight: 1.45 }}>
              <strong>System notifications</strong> — when this window is in the background, new workflow messages can
              appear in the Windows / macOS notification tray (same copy as listed here).
            </div>
            {pushStatus === "granted" ? (
              <span className="badge-completed" style={{ textTransform: "none" }}>
                Enabled
              </span>
            ) : pushStatus === "denied" ? (
              <span style={{ fontSize: "0.85rem", opacity: 0.85 }}>Blocked in browser settings — enable notifications for this app.</span>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  const p = await requestSystemNotificationPermission();
                  setPushStatus(p);
                }}
              >
                Enable system notifications
              </button>
            )}
          </div>
        )}

        {canBroadcast ? (
          <div
            style={{
              marginBottom: "1rem",
              padding: "1rem",
              borderRadius: "12px",
              border: "1px solid rgba(15,23,42,0.12)",
              background: "rgba(22, 163, 74, 0.05)",
              display: "grid",
              gap: "0.75rem",
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.98rem" }}>Send announcement</div>
              <div style={{ marginTop: "0.2rem", fontSize: "0.88rem", opacity: 0.82 }}>
                Send a custom notification to every active user. It will show in the notification feed on desktop and mobile.
              </div>
            </div>
            <input
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="Title"
              style={{
                width: "100%",
                borderRadius: "10px",
                border: "1px solid rgba(15,23,42,0.14)",
                padding: "0.8rem 0.9rem",
                fontSize: "0.95rem",
                background: "#fff",
              }}
            />
            <textarea
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Message"
              rows={3}
              style={{
                width: "100%",
                borderRadius: "10px",
                border: "1px solid rgba(15,23,42,0.14)",
                padding: "0.8rem 0.9rem",
                fontSize: "0.95rem",
                resize: "vertical",
                background: "#fff",
              }}
            />
            <div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={broadcastBusy || !broadcastTitle.trim()}
                onClick={() => void onBroadcast()}
              >
                {broadcastBusy ? "Sending…" : "Send to all users"}
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(e) => {
                setOnlyUnread(e.target.checked);
              }}
            />
            Unread only
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          {unreadTotal > 0 ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onMarkAll()}>
              Mark all read ({unreadTotal})
            </button>
          ) : null}
        </div>

        {loading && !rows.length ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No notifications.</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {rows.map((n) => (
              <li
                key={n.id}
                style={{
                  border: "1px solid var(--clr-border, rgba(15,23,42,0.12))",
                  borderRadius: "10px",
                  padding: "0.85rem 1rem",
                  background: n.read_at ? "transparent" : "rgba(59, 130, 246, 0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{n.title}</div>
                    {n.body ? (
                      <div style={{ marginTop: "0.35rem", opacity: 0.9, fontSize: "0.92rem" }}>{n.body}</div>
                    ) : null}
                    <div style={{ marginTop: "0.35rem", fontSize: "0.82rem", opacity: 0.7 }}>{formatTs(n.created_at)}</div>
                  </div>
                  <div>
                    {!n.read_at ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onMarkRead(n.id)}>
                        Acknowledge
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
