import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore.js";
import * as sessionsApi from "@/api/sessions.js";

function formatTs(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function clientLabel(kind) {
  const m = { tauri: "Desktop", expo: "Mobile", web: "Web", unknown: "Unknown" };
  return m[kind] || kind || "—";
}

export function SecuritySessionsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <div className="page-records__head">
        <h2 className="page-records__title">Devices</h2>
        <p style={{ margin: 0, opacity: 0.85, maxWidth: "52rem" }}>
          Where your account is currently signed in (read-only).
        </p>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        {error ? (
          <div className="login-error" role="alert" style={{ marginBottom: "0.75rem" }}>
            {error}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {loading && !rows.length ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No active sessions.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table-records" style={{ minWidth: "640px" }}>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Client</th>
                  <th>IP</th>
                  <th>Signed in</th>
                  <th>Last active</th>
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
                    <td>{clientLabel(s.client_kind)}</td>
                    <td>{s.ip_address || "—"}</td>
                    <td>{formatTs(s.created_at)}</td>
                    <td>{formatTs(s.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
