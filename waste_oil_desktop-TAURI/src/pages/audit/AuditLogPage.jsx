import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/authStore.js";
import * as auditApi from "@/api/audit.js";

const PAGE_SIZE = 50;

function toDay(isoTs) {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toISOString().slice(0, 10);
}

function formatTs(isoTs) {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function groupLogs(rows, mode) {
  const map = new Map();
  for (const row of rows) {
    let key = "Other";
    if (mode === "day") key = toDay(row.timestamp);
    else if (mode === "action") key = row.action || "Unknown action";
    else if (mode === "user") key = row.username ? `@${row.username}` : "System";
    const curr = map.get(key) || [];
    curr.push(row);
    map.set(key, curr);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}

export function AuditLogPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);

  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState("day");

  useEffect(() => {
    if (!user || !["manager", "gm"].includes(user.role)) return;
    setLoading(true);
    setError("");
    auditApi
      .getLogs(
        {
          page,
          page_size: PAGE_SIZE,
          action: action || undefined,
          search: search || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
        token,
      )
      .then((data) => {
        const results = Array.isArray(data?.results) ? data.results : [];
        setRows(results);
        setCount(Number(data?.count || 0));
      })
      .catch((e) => setError(e?.message || "Could not load audit logs"))
      .finally(() => setLoading(false));
  }, [user, token, page, action, search, dateFrom, dateTo]);

  const groups = useMemo(() => groupLogs(rows, groupBy), [rows, groupBy]);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (!user || !["manager", "gm"].includes(user.role)) {
    return (
      <div className="card">
        <h3 className="card__subtitle">Audit Logs</h3>
        <div style={{ opacity: 0.75 }}>Only Manager and GM can view audit logs.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-records__head">
        <h2 className="page-records__title">Audit Logs</h2>
      </div>

      <div className="card record-list-filters-card" style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label>Action</label>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {["CREATE", "EDIT", "FORWARD", "RETURN", "APPROVE", "LOGIN", "LOGOUT", "EXPORT", "ALERT_SENT", "DELETE"].map(
              (a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="field">
          <label>Date from</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label>Date to</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label>Group by</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="day">Day</option>
            <option value="action">Action</option>
            <option value="user">User</option>
          </select>
        </div>
        <div className="field field--wide">
          <label>Search</label>
          <input
            value={search}
            placeholder="Action, description, user, record number..."
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error ? (
        <div className="record-readonly-hint" role="alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="fullscreen-center">
          <div className="spinner" />
        </div>
      ) : (
        groups.map((g) => (
          <div className="card" key={g.group} style={{ marginBottom: "1rem" }}>
            <h3 className="card__subtitle" style={{ marginBottom: "0.6rem" }}>
              {g.group} ({g.items.length})
            </h3>
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Record</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((r) => (
                    <tr key={r.id} style={{ cursor: "default" }}>
                      <td>{formatTs(r.timestamp)}</td>
                      <td>{r.action || "—"}</td>
                      <td>{r.username ? `@${r.username}` : "System"}</td>
                      <td>{r.record_number || "—"}</td>
                      <td>{r.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div className="pagination-bar">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span style={{ fontSize: "0.9rem" }}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
