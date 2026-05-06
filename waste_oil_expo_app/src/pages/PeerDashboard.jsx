import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRecordStore } from "@/store/recordStore.js";
import { useWorkflowStore } from "@/store/workflowStore.js";
import { useAuthStore } from "@/store/authStore.js";
import { KPICard } from "@/components/dashboard/index.js";
import { buildRecordsSearch } from "@/components/dashboard/buildRecordsHref.js";
import { formatDate, formatQty } from "@/utils/formatters.js";
import { StatusBadge } from "@/components/records/StatusBadge.jsx";
import { stageForRole } from "@/utils/permissions.js";
import { LOOKBACK_OPTIONS, STAGE_LABELS } from "@/pages/dashboardConstants.js";

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayDiff(fromDate, toDateValue) {
  const d = toDate(toDateValue);
  if (!d) return null;
  return Math.ceil((d.getTime() - fromDate.getTime()) / 86400000);
}

export function PeerDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const mustChangePassword = Boolean(user?.must_change_password);
  const myStage = stageForRole(user?.role);

  const fetchAll = useRecordStore((s) => s.fetchAll);
  const records = useRecordStore((s) => s.records);
  const fetchQueue = useWorkflowStore((s) => s.fetchQueue);
  const queue = useWorkflowStore((s) => s.queue);

  const [lookbackDays, setLookbackDays] = useState(0);
  const [alertFilter, setAlertFilter] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchQueue().catch(() => {});
    const timer = setTimeout(() => {
      fetchAll({ page_size: 120 }).catch(() => {});
    }, 60);
    return () => clearTimeout(timer);
  }, [fetchAll, fetchQueue]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const cutoff = useMemo(() => {
    if (!lookbackDays) return null;
    const d = new Date(today);
    d.setDate(d.getDate() - lookbackDays);
    return d;
  }, [lookbackDays, today]);

  const startDate = useMemo(() => {
    if (!dateFrom) return null;
    const d = toDate(dateFrom);
    if (!d) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dateFrom]);

  const endDate = useMemo(() => {
    if (!dateTo) return null;
    const d = toDate(dateTo);
    if (!d) return null;
    d.setHours(23, 59, 59, 999);
    return d;
  }, [dateTo]);

  const atMyStageOpen = useMemo(() => {
    if (myStage == null) return [];
    return records.filter(
      (r) =>
        String(r.alert_level || "").toLowerCase() !== "completed" &&
        Number(r.current_stage) === Number(myStage),
    );
  }, [records, myStage]);

  const filteredRecords = useMemo(() => {
    return atMyStageOpen.filter((record) => {
      const entry = toDate(record.entry_date);
      const isRangeMode = Boolean(startDate || endDate);
      if (isRangeMode) {
        if (startDate && (!entry || entry < startDate)) return false;
        if (endDate && (!entry || entry > endDate)) return false;
      } else if (cutoff && entry && entry < cutoff) {
        return false;
      }
      if (alertFilter && record.alert_level !== alertFilter) return false;
      return true;
    });
  }, [atMyStageOpen, cutoff, startDate, endDate, alertFilter]);

  const scopeForLinks = useMemo(
    () => ({
      dateFrom,
      dateTo,
      lookbackDays,
      todayStart: today,
    }),
    [dateFrom, dateTo, lookbackDays, today],
  );

  const goRecords = (extra) => {
    const merged =
      myStage != null ? { ...extra, stage: Number(myStage) } : { ...extra };
    navigate(`/records${buildRecordsSearch(scopeForLinks, merged)}`);
  };

  const inProgressSorted = useMemo(
    () =>
      [...filteredRecords].sort((a, b) =>
        String(b.entry_date).localeCompare(String(a.entry_date)),
      ),
    [filteredRecords],
  );

  const overdueCount = useMemo(
    () => filteredRecords.filter((r) => (r.alert_level || "").toLowerCase() === "red").length,
    [filteredRecords],
  );

  const dueSoonRecords = useMemo(() => {
    return filteredRecords
      .map((r) => ({ ...r, dueInDays: dayDiff(today, r.due_date) }))
      .filter((r) => r.dueInDays !== null && r.dueInDays >= 0 && r.dueInDays <= 7)
      .sort((a, b) => a.dueInDays - b.dueInDays);
  }, [filteredRecords, today]);

  const queueCount = queue.length;
  const activeInScope = filteredRecords.length;

  const stageName = myStage != null ? STAGE_LABELS[myStage] || `Stage ${myStage}` : "your workflow step";

  const clearFilters = () => {
    setAlertFilter(null);
    setDateFrom("");
    setDateTo("");
    setLookbackDays(0);
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__intro">
        <h2 className="dashboard-page__title">Dashboard</h2>
        <p className="dashboard-page__greeting">
          Hello {user?.full_name || user?.username || "there"}
          <span aria-hidden> 👋</span>
        </p>
        <p className="dashboard-page__lede">
          <strong>{stageName}</strong> — open records assigned to your step only (no graphs or totals for other
          steps). Completed items are omitted here; use Records for full history where you have access.
        </p>
      </div>

      <div className="card dashboard-toolbar dashboard-toolbar-simple" style={{ marginBottom: "1rem", padding: "0.85rem 1rem" }}>
        <div className="dashboard-toolbar-row" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <div style={{ opacity: 0.8, fontSize: "0.85rem", marginRight: "0.35rem" }}>Window:</div>
          {LOOKBACK_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setLookbackDays(opt.value);
                setDateFrom("");
                setDateTo("");
              }}
              style={{
                padding: "0.35rem 0.7rem",
                border: lookbackDays === opt.value ? "1px solid #6ec8ff" : "1px solid var(--clr-border)",
              }}
            >
              {opt.label}
            </button>
          ))}
          <div style={{ opacity: 0.8, fontSize: "0.85rem", marginLeft: "0.35rem" }}>Range:</div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              if (e.target.value || dateTo) {
                setLookbackDays(0);
              }
            }}
            style={{
              border: "1px solid var(--clr-border)",
              borderRadius: "8px",
              padding: "0.35rem 0.5rem",
              background: "var(--clr-surface)",
              color: "inherit",
              fontSize: "0.78rem",
            }}
          />
          <span style={{ opacity: 0.7, fontSize: "0.78rem" }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              if (e.target.value || dateFrom) {
                setLookbackDays(0);
              }
            }}
            style={{
              border: "1px solid var(--clr-border)",
              borderRadius: "8px",
              padding: "0.35rem 0.5rem",
              background: "var(--clr-surface)",
              color: "inherit",
              fontSize: "0.78rem",
            }}
          />
          <button type="button" className="btn btn-ghost dashboard-filter-chip" onClick={clearFilters} style={{ padding: "0.35rem 0.7rem", marginLeft: "0.35rem" }}>
            Reset
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginLeft: "0.5rem" }}>
            <span style={{ opacity: 0.75, fontSize: "0.8rem" }}>Alert:</span>
            <select
              value={alertFilter || ""}
              onChange={(e) => setAlertFilter(e.target.value || null)}
              style={{
                border: "1px solid var(--clr-border)",
                borderRadius: "8px",
                padding: "0.3rem 0.45rem",
                background: "var(--clr-surface)",
                color: "inherit",
                fontSize: "0.78rem",
                minWidth: 110,
              }}
            >
              <option value="">All</option>
              <option value="green">Green</option>
              <option value="yellow">Yellow</option>
              <option value="orange">Orange</option>
              <option value="red">Red</option>
            </select>
          </div>
          <div className="dashboard-toolbar-scope" style={{ marginLeft: "auto", opacity: 0.7, fontSize: "0.82rem" }}>
            In scope (your step): {filteredRecords.length}
          </div>
        </div>
      </div>

      <div className="dashboard-kpi-grid">
        <KPICard
          variant="queue"
          label="My queue"
          hint={
            mustChangePassword ? "Change your password to open your queue." : "Waiting for you now."
          }
          value={queueCount}
          onClick={mustChangePassword ? undefined : () => navigate("/queue")}
          subtext={
            mustChangePassword ? "Available after you update your password." : "Not limited by filters above."
          }
        />

        <KPICard
          variant="active"
          label="Open at my step"
          hint={`${stageName} pipeline only.`}
          value={activeInScope}
          subtext="After date & alert filters."
          onClick={() => goRecords({ exclude_completed: true })}
        />

        <KPICard
          variant="overdue"
          label="Overdue"
          hint="Red-alert records at my step."
          value={overdueCount}
          subtext="Filtered scope."
          onClick={() => goRecords({ alert_level: "red", exclude_completed: true })}
        />
      </div>

      <div className="dashboard-tables-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="card dashboard-table-card">
          <div className="dashboard-table-card__head">
            <h3 className="dashboard-table-card__title">Open records at my step</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => goRecords({ exclude_completed: true })}>
              View in list
            </button>
          </div>
          <div className="table-wrap dashboard-table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Vendor</th>
                  <th>Alert</th>
                  <th>Qty</th>
                  <th>Entry</th>
                </tr>
              </thead>
              <tbody>
                {inProgressSorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="dashboard-table-empty">
                      No open records at your step in this scope.
                    </td>
                  </tr>
                ) : (
                  inProgressSorted.slice(0, 16).map((r) => (
                    <tr key={r.id} onClick={() => navigate(`/records/${r.id}`)}>
                      <td style={{ fontWeight: 600 }}>{r.record_number}</td>
                      <td>{r.vendor_name || "—"}</td>
                      <td>
                        <StatusBadge level={r.alert_level} />
                      </td>
                      <td>{formatQty(r.quantity, r.unit)}</td>
                      <td>{formatDate(r.entry_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="dashboard-mobile-panels">
        <div className="card">
          <div className="dashboard-table-card__head">
            <h3 className="dashboard-table-card__title">Open records at my step</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => goRecords({ exclude_completed: true })}>
              View in list
            </button>
          </div>
          {inProgressSorted.length === 0 ? (
            <div className="dashboard-table-empty">No open records at your step in this scope.</div>
          ) : (
            <div className="dashboard-mobile-list">
              {inProgressSorted.slice(0, 12).map((r) => (
                <button key={r.id} type="button" className="dashboard-mobile-record" onClick={() => navigate(`/records/${r.id}`)}>
                  <div className="dashboard-mobile-record__head">
                    <strong>{r.record_number}</strong>
                    <StatusBadge level={r.alert_level} />
                  </div>
                  <div className="dashboard-mobile-record__meta">{r.vendor_name || "Unknown Vendor"}</div>
                  <div className="dashboard-mobile-record__meta">
                    {formatQty(r.quantity, r.unit)} - {formatDate(r.entry_date)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Due soon (next 7 days)</div>
          <button type="button" className="btn btn-ghost" onClick={() => goRecords({ exclude_completed: true })}>
            View records
          </button>
        </div>
        {dueSoonRecords.length === 0 ? (
          <div style={{ opacity: 0.72, fontSize: "0.82rem" }}>
            Nothing due in the next week for this scope — or no due dates set.
          </div>
        ) : (
          dueSoonRecords.slice(0, 8).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate(`/records/${r.id}`)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                color: "inherit",
                border: "1px solid var(--clr-border)",
                borderRadius: "8px",
                padding: "0.55rem 0.7rem",
                marginBottom: "0.45rem",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                <span>{r.record_number}</span>
                <span style={{ opacity: 0.8 }}>due in {r.dueInDays} day(s)</span>
              </div>
              <div style={{ fontSize: "0.78rem", opacity: 0.75, marginTop: "0.2rem" }}>{r.vendor_name || "Unknown Vendor"}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
