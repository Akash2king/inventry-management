import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/authStore.js";
import { useUiStore } from "@/store/uiStore.js";
import * as sessionsApi from "@/api/sessions.js";

function formatTs(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatRelativeTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatTs(iso);
}

function clientLabel(kind) {
  const m = { tauri: "Desktop", expo: "Mobile", web: "Web", unknown: "Unknown" };
  return m[kind] || kind || "—";
}

export function SecuritySessionsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const showToast = useUiStore((s) => s.showToast);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState(null);
  const [bulkRevoking, setBulkRevoking] = useState(false);

  const otherSessions = useMemo(() => rows.filter((s) => !s.is_current), [rows]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await sessionsApi.listSessions(true, token);
      setRows(Array.isArray(data?.results) ? data.results : []);
    } catch (e) {
      setError(e?.message || "Could not load sessions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRevoke(session) {
    if (!token || session.is_current) return;
    const label = session.device_label || "this device";
    if (!window.confirm(`Sign out “${label}”? That device will need to sign in again.`)) {
      return;
    }
    setRevokingId(session.id);
    try {
      await sessionsApi.revokeSession(session.id, token);
      showToast("Device signed out.", "success");
      await load();
    } catch (e) {
      showToast(e?.message || "Could not end session", "error");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRevokeOthers() {
    if (!token || !otherSessions.length) return;
    if (
      !window.confirm(
        `Sign out ${otherSessions.length} other device${otherSessions.length === 1 ? "" : "s"}? Only this device will stay signed in.`,
      )
    ) {
      return;
    }
    setBulkRevoking(true);
    try {
      const result = await sessionsApi.revokeAllOtherSessions(token);
      if (result?.failed) {
        showToast(
          `Signed out ${result.revoked} device(s); ${result.failed} could not be ended.`,
          "error",
        );
      } else {
        showToast(
          result?.revoked
            ? `Signed out ${result.revoked} other device${result.revoked === 1 ? "" : "s"}.`
            : "No other devices were signed in.",
          "success",
        );
      }
      await load();
    } catch (e) {
      showToast(e?.message || "Could not sign out other devices", "error");
    } finally {
      setBulkRevoking(false);
    }
  }

  const busy = Boolean(revokingId) || bulkRevoking;

  return (
    <div>
      <div className="page-records__head">
        <h2 className="page-records__title">Devices</h2>
        <p style={{ margin: 0, opacity: 0.85, maxWidth: "52rem" }}>
          Where your account is currently signed in. Sign out any device you do not recognize.
        </p>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        {error ? (
          <div className="login-error" role="alert" style={{ marginBottom: "0.75rem" }}>
            {error}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading || busy}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          {otherSessions.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void handleRevokeOthers()}
              disabled={busy}
              style={{ color: "var(--clr-danger, #b91c1c)" }}
            >
              {bulkRevoking
                ? "Signing out…"
                : `Sign out ${otherSessions.length} other device${otherSessions.length === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>

        {loading && !rows.length ? (
          <div className="fullscreen-center" style={{ minHeight: 120 }}>
            <div className="spinner" />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>
            No active sessions. When you sign in on other phones or desktops, they will appear here.
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", opacity: 0.75 }}>
              {rows.length} active session{rows.length === 1 ? "" : "s"}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="table-records" style={{ minWidth: "720px" }}>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Client</th>
                    <th>IP</th>
                    <th>Signed in</th>
                    <th>Last active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.device_label || "—"}</div>
                        <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>{s.platform || ""}</div>
                        {s.is_current ? (
                          <span className="badge-completed" style={{ marginTop: 4, display: "inline-block" }}>
                            This device
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {clientLabel(s.client_kind)}
                        {s.app_version ? ` · v${s.app_version}` : ""}
                      </td>
                      <td>{s.ip_address || "—"}</td>
                      <td>{formatTs(s.created_at)}</td>
                      <td title={formatTs(s.last_seen_at)}>{formatRelativeTime(s.last_seen_at)}</td>
                      <td>
                        {!s.is_current ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => void handleRevoke(s)}
                            style={{ color: "var(--clr-danger, #b91c1c)" }}
                          >
                            {revokingId === s.id ? "…" : "Sign out"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
