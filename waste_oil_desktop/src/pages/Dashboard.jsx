import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRecordStore } from "@/store/recordStore.js";
import { useWorkflowStore } from "@/store/workflowStore.js";
import { useAuthStore } from "@/store/authStore.js";
import { useAnalytics, KPICard, StageDistributionCard } from "@/components/dashboard/index.js";
import { buildRecordsSearch } from "@/components/dashboard/buildRecordsHref.js";
import { VendorContactModal } from "@/components/vendors/VendorContactModal.jsx";
import { showToast } from "@/components/ui/ToastContainer.jsx";
import { downloadExcelFile } from "@/utils/excelExport.js";


const LOOKBACK_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
  { label: "All", value: 0 },
];

const STAGE_LABELS = {
  1: "Storeman",
  2: "Treatment",
  3: "Manager",
  4: "Admin",
  5: "GM",
};

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDayKey(value) {
  const d = toDate(value);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function dayDiff(fromDate, toDateValue) {
  const d = toDate(toDateValue);
  if (!d) return null;
  return Math.ceil((d.getTime() - fromDate.getTime()) / 86400000);
}

function ageDays(record, today) {
  if (typeof record.days_elapsed === "number") return record.days_elapsed;
  const entry = toDate(record.entry_date);
  if (!entry) return null;
  return Math.max(0, Math.floor((today.getTime() - entry.getTime()) / 86400000));
}

function normalizeUnit(unit) {
  if (!unit) return "";
  const value = String(unit).trim();
  if (!value) return "";
  if (["kg", "kgs", "kilogram", "kilograms"].includes(value.toLowerCase())) {
    return "Kgs";
  }
  return value;
}

export function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const fetchAll = useRecordStore((s) => s.fetchAll);
  const records = useRecordStore((s) => s.records);
  const fetchQueue = useWorkflowStore((s) => s.fetchQueue);
  const queue = useWorkflowStore((s) => s.queue);

  const { analytics, loading: analyticsLoading, error: analyticsError } = useAnalytics();
  const [lookbackDays, setLookbackDays] = useState(0);
  const [stageFilter, setStageFilter] = useState(null);
  const [alertFilter, setAlertFilter] = useState(null);
  const [vendorUnitFilter, setVendorUnitFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vendorModal, setVendorModal] = useState(null);

  useEffect(() => {
    fetchAll({ page_size: 250 }).catch(() => {});
    fetchQueue().catch(() => {});
  }, [fetchAll, fetchQueue]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const entry = toDate(record.entry_date);
      const isRangeMode = Boolean(startDate || endDate);
      if (isRangeMode) {
        if (startDate && (!entry || entry < startDate)) return false;
        if (endDate && (!entry || entry > endDate)) return false;
      } else if (cutoff && entry && entry < cutoff) {
        return false;
      }
      if (stageFilter && Number(record.current_stage) !== Number(stageFilter)) return false;
      if (alertFilter && record.alert_level !== alertFilter) return false;
      return true;
    });
  }, [records, cutoff, startDate, endDate, stageFilter, alertFilter]);

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
    navigate(`/records${buildRecordsSearch(scopeForLinks, extra)}`);
  };

  const total = filteredRecords.length;
  const queueCount = queue.length;
  const activeApprox = filteredRecords.filter((r) => r.alert_level !== "completed").length;

  const completionBase = filteredRecords.length || 0;
  const completedInScope = filteredRecords.filter((r) => r.alert_level === "completed").length;
  const completionRate = completionBase > 0 ? Math.round((completedInScope / completionBase) * 100) : 0;

  const overdueCount = filteredRecords.filter((r) => {
    const dd = dayDiff(today, r.due_date);
    return dd !== null && dd < 0 && r.alert_level !== "completed";
  }).length;

  const dueSoonRecords = filteredRecords
    .map((r) => ({ ...r, dueInDays: dayDiff(today, r.due_date) }))
    .filter((r) => r.dueInDays !== null && r.dueInDays >= 0 && r.dueInDays <= 7 && r.alert_level !== "completed")
    .sort((a, b) => a.dueInDays - b.dueInDays);

  const alertCounts = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0, completed: 0 };
    filteredRecords.forEach((r) => {
      if (counts[r.alert_level] !== undefined) counts[r.alert_level] += 1;
    });
    return counts;
  }, [filteredRecords]);

  const trendData = useMemo(() => {
    const days = lookbackDays || 30;
    const bucket = new Map();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      bucket.set(d.toISOString().slice(0, 10), 0);
    }
    filteredRecords.forEach((r) => {
      const k = formatDayKey(r.entry_date);
      if (k && bucket.has(k)) bucket.set(k, (bucket.get(k) || 0) + 1);
    });
    return Array.from(bucket.entries()).map(([date, count]) => ({ date, count }));
  }, [filteredRecords, lookbackDays, today]);

  const trendMax = Math.max(1, ...trendData.map((d) => d.count));

  const unitOptions = useMemo(() => {
    const units = new Set();
    filteredRecords.forEach((r) => {
      const normalized = normalizeUnit(r.unit);
      if (normalized) units.add(normalized);
    });
    units.add("Kgs");
    return ["all", ...Array.from(units).sort((a, b) => a.localeCompare(b))];
  }, [filteredRecords]);

  const topVendors = useMemo(() => {
    const map = new Map();
    filteredRecords
      .filter((r) => vendorUnitFilter === "all" || normalizeUnit(r.unit) === vendorUnitFilter)
      .forEach((r) => {
        const name = r.vendor_name || "Unknown Vendor";
        const vid = r.vendor_id ? String(r.vendor_id) : null;
        const key = vid || `name:${name}`;
        const qty = Number(r.quantity || 0);
        const curr = map.get(key) || { vendor_id: vid, name, count: 0, quantity: 0 };
        curr.name = name;
        if (vid) curr.vendor_id = vid;
        curr.count += 1;
        curr.quantity += qty;
        map.set(key, curr);
      });
    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredRecords, vendorUnitFilter]);

  const departmentWorkload = useMemo(() => {
    const map = new Map();
    filteredRecords.forEach((r) => {
      const dept = r.current_department_name || "Unassigned";
      const current = map.get(dept) || { active: 0, completed: 0, total: 0 };
      current.total += 1;
      if (r.alert_level === "completed") {
        current.completed += 1;
      } else {
        current.active += 1;
      }
      map.set(dept, current);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.active - a.active || b.total - a.total);
  }, [filteredRecords]);

  const agingBuckets = useMemo(() => {
    const buckets = {
      "0-7": 0,
      "8-15": 0,
      "16-30": 0,
      "30+": 0,
    };
    filteredRecords.forEach((r) => {
      if (r.alert_level === "completed") return;
      const days = ageDays(r, today);
      if (days === null) return;
      if (days <= 7) buckets["0-7"] += 1;
      else if (days <= 15) buckets["8-15"] += 1;
      else if (days <= 30) buckets["16-30"] += 1;
      else buckets["30+"] += 1;
    });
    return buckets;
  }, [filteredRecords, today]);

  const maxAging = Math.max(1, ...Object.values(agingBuckets));

  const exportDueSoonExcel = async () => {
    const rows = dueSoonRecords.map((r) => [
      r.record_number,
      r.vendor_name || "Unknown Vendor",
      r.current_department_name || "Unassigned",
      STAGE_LABELS[Number(r.current_stage)] || r.current_stage,
      r.alert_level,
      r.quantity,
      r.due_date,
      r.dueInDays,
    ]);
    try {
      const saved = await downloadExcelFile(
        "dashboard_due_soon_snapshot.xlsx",
        "Due Soon",
        ["record_number", "vendor", "department", "stage", "alert_level", "quantity", "due_date", "due_in_days"],
        rows,
      );
      if (saved) showToast("Excel export ready.", "success");
    } catch (e) {
      showToast(e?.message || "Export failed", "error");
    }
  };

  const exportTopVendorsExcel = async () => {
    const rows = topVendors.map((v) => [
      v.name,
      vendorUnitFilter === "all" ? "mixed" : vendorUnitFilter,
      v.count,
      v.quantity.toFixed(2),
      v.count > 0 ? (v.quantity / v.count).toFixed(2) : "0.00",
    ]);
    try {
      const saved = await downloadExcelFile(
        "dashboard_top_vendors_snapshot.xlsx",
        "Top Vendors",
        ["vendor", "unit", "record_count", "total_quantity", "avg_quantity_per_record"],
        rows,
      );
      if (saved) showToast("Excel export ready.", "success");
    } catch (e) {
      showToast(e?.message || "Export failed", "error");
    }
  };

  const clearFilters = () => {
    setStageFilter(null);
    setAlertFilter(null);
    setVendorUnitFilter("all");
    setDateFrom("");
    setDateTo("");
    setLookbackDays(0);
  };

  return (
    <div>
      <div className="dashboard-page__intro" style={{ marginBottom: "1rem" }}>
        <h2 className="dashboard-page__title" style={{ color: "var(--clr-text-bright)", marginTop: 0, marginBottom: "0.35rem" }}>
          Dashboard
        </h2>
        <p style={{ margin: "0 0 0.25rem", opacity: 0.92 }}>
          Hello {user?.full_name || user?.username || "there"}
          <span aria-hidden> 👋</span>
        </p>
        <p style={{ margin: 0, maxWidth: "44rem", lineHeight: 1.5, opacity: 0.82, fontSize: "0.9rem" }}>
          Numbers below match your date window and filters (up to 250 records loaded here).
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1rem", padding: "0.85rem 1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
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
          <button
            type="button"
            className="btn btn-ghost"
            onClick={clearFilters}
            style={{ padding: "0.35rem 0.7rem", marginLeft: "0.35rem" }}
          >
            Reset
          </button>
          <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: "0.82rem" }}>
            Scope: {filteredRecords.length} records
          </div>
        </div>
      </div>

      <div className="dashboard-kpi-grid">
        <KPICard
          variant="total"
          label="Total records"
          hint="Records in this date window and filters."
          value={total}
          subtext="Same as Scope above."
          onClick={() => goRecords({})}
        />

        <KPICard
          variant="queue"
          label="My queue"
          hint="Waiting for you at your stage."
          value={queueCount}
          onClick={() => navigate("/queue")}
          subtext="Not limited by the date window."
        />

        <KPICard
          variant="active"
          label="Active records"
          hint="Not completed yet."
          value={activeApprox}
          subtext="In this scope."
          onClick={() => goRecords({ exclude_completed: true })}
        />

        <KPICard
          variant="overdue"
          label="Overdue"
          hint="Past due and still open."
          value={overdueCount}
          subtext="Compared to today."
          onClick={() => goRecords({ overdue: true })}
        />

        <KPICard
          variant="completion"
          label="Completion rate"
          hint="Finished (completed) in this scope."
          value={`${completionRate}%`}
          subtext={`${completedInScope} of ${completionBase || 0} in scope.`}
          onClick={() => goRecords({ alert_level: "completed" })}
        />
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Due Soon (next 7 days)</div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn btn-ghost" onClick={() => void exportDueSoonExcel()}>
              Export Excel
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => goRecords({})}>
              View records
            </button>
          </div>
        </div>
        {dueSoonRecords.length === 0 ? (
          <div style={{ opacity: 0.72, fontSize: "0.82rem" }}>No records due in the next 7 days for the selected scope.</div>
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
              <div style={{ fontSize: "0.78rem", opacity: 0.75, marginTop: "0.2rem" }}>
                {r.vendor_name || "Unknown Vendor"} - {STAGE_LABELS[Number(r.current_stage)] || "Stage"}
              </div>
            </button>
          ))
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div className="card">
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.6rem" }}>Entry Trend</div>
          <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "160px" }}>
            {trendData.map((point) => (
              <div
                key={point.date}
                title={`${point.date}: ${point.count}`}
                style={{
                  flex: 1,
                  minWidth: "4px",
                  background: "linear-gradient(180deg, #7dd8ff, #3578e5)",
                  borderRadius: "3px 3px 0 0",
                  height: `${Math.max(6, (point.count / trendMax) * 100)}%`,
                  opacity: point.count ? 1 : 0.25,
                }}
              />
            ))}
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", opacity: 0.7 }}>
            Last {lookbackDays || "all"} days by entry date
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.6rem" }}>Alert Mix</div>
          {Object.entries(alertCounts).map(([level, count]) => {
            const ratio = filteredRecords.length ? Math.round((count / filteredRecords.length) * 100) : 0;
            const color =
              level === "red" ? "#ff5f7a" : level === "yellow" ? "#ffcf5a" : level === "completed" ? "#4f86ff" : "#36d27e";
            return (
              <button
                key={level}
                type="button"
                onClick={() => setAlertFilter(alertFilter === level ? null : level)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: alertFilter === level ? "1px solid #6ec8ff" : "1px solid var(--clr-border)",
                  borderRadius: "8px",
                  background: "transparent",
                  padding: "0.45rem 0.55rem",
                  marginBottom: "0.45rem",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", textTransform: "capitalize" }}>
                  <span>{level}</span>
                  <span>{count} ({ratio}%)</span>
                </div>
                <div style={{ marginTop: "0.3rem", height: "6px", borderRadius: "999px", background: "rgba(255,255,255,0.08)" }}>
                  <div style={{ width: `${ratio}%`, height: "100%", borderRadius: "999px", background: color }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
        {!analyticsError && (
          <div>
            <StageDistributionCard
              data={analytics?.stage || []}
              loading={analyticsLoading}
              hint="How many records sit at each workflow stage in this scope."
            />

            <div style={{ marginTop: "0.55rem", display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
              {[1, 2, 3, 4, 5].map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setStageFilter(stageFilter === stage ? null : stage)}
                  style={{
                    padding: "0.25rem 0.55rem",
                    border: stageFilter === stage ? "1px solid #6ec8ff" : "1px solid var(--clr-border)",
                    fontSize: "0.78rem",
                  }}
                >
                  {STAGE_LABELS[stage]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Top Vendors by Volume</div>
              <div style={{ fontSize: "0.78rem", opacity: 0.75, marginTop: "0.25rem", fontWeight: 500 }}>
                Highest total quantity in this scope. Click a name for contact details.
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select
                value={vendorUnitFilter}
                onChange={(e) => setVendorUnitFilter(e.target.value)}
                style={{
                  border: "1px solid var(--clr-border)",
                  borderRadius: "8px",
                  padding: "0.35rem 0.5rem",
                  background: "var(--clr-surface)",
                  color: "inherit",
                  fontSize: "0.78rem",
                }}
              >
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit === "all" ? "All Units" : unit}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost" onClick={() => void exportTopVendorsExcel()}>
                Export Excel
              </button>
            </div>
          </div>
          {topVendors.length === 0 ? (
            <div style={{ opacity: 0.7, fontSize: "0.82rem" }}>
              No vendor data for selected unit.
            </div>
          ) : (
            topVendors.map((v) => (
              <div
                key={v.vendor_id || v.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.45rem 0",
                  borderBottom: "1px dashed rgba(255,255,255,0.12)",
                  fontSize: "0.82rem",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{
                    maxWidth: "62%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    justifyContent: "flex-start",
                    fontWeight: 600,
                    padding: "0.15rem 0.35rem",
                    margin: "-0.15rem -0.35rem",
                  }}
                  title="Vendor contact"
                  onClick={() => {
                    if (v.vendor_id) {
                      setVendorModal({ vendorId: v.vendor_id, fallbackName: v.name });
                    } else {
                      setVendorModal({ detail: { name: v.name, contact: "", address: "", notes: "" } });
                    }
                  }}
                >
                  {v.name}
                </button>
                <span style={{ flexShrink: 0 }}>
                  {v.quantity.toFixed(1)} {vendorUnitFilter === "all" ? "qty" : vendorUnitFilter} ({v.count})
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <div className="card">
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>Department Workload</div>
          {departmentWorkload.length === 0 ? (
            <div style={{ opacity: 0.7, fontSize: "0.82rem" }}>No department workload in current scope.</div>
          ) : (
            departmentWorkload.map((dept) => (
              <div key={dept.name} style={{ marginBottom: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                  <span>{dept.name}</span>
                  <span>{dept.active} active / {dept.completed} completed</span>
                </div>
                <div style={{ marginTop: "0.2rem", height: "7px", borderRadius: "999px", background: "rgba(255,255,255,0.08)" }}>
                  <div
                    style={{
                      width: `${dept.total ? Math.round((dept.active / dept.total) * 100) : 0}%`,
                      height: "100%",
                      borderRadius: "999px",
                      background: "linear-gradient(90deg, #ff9e58, #ff5f7a)",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>Record Aging Buckets</div>
          {Object.entries(agingBuckets).map(([label, count]) => (
            <div key={label} style={{ marginBottom: "0.55rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span>{label} days</span>
                <span>{count}</span>
              </div>
              <div style={{ marginTop: "0.2rem", height: "7px", borderRadius: "999px", background: "rgba(255,255,255,0.08)" }}>
                <div
                  style={{
                    width: `${Math.round((count / maxAging) * 100)}%`,
                    height: "100%",
                    borderRadius: "999px",
                    background:
                      label === "30+"
                        ? "#ff5f7a"
                        : label === "16-30"
                          ? "#ff9e58"
                          : label === "8-15"
                            ? "#ffcf5a"
                            : "#60c8ff",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {analyticsError && (
        <div style={{ padding: "1rem", opacity: 0.6, fontSize: "0.85rem" }}>
          Analytics endpoint unavailable. Dashboard still uses live records and queue data.
        </div>
      )}

      {vendorModal ? (
        <VendorContactModal
          onClose={() => setVendorModal(null)}
          detail={vendorModal.detail}
          vendorId={vendorModal.vendorId}
          fallbackName={vendorModal.fallbackName}
        />
      ) : null}
    </div>
  );
}
