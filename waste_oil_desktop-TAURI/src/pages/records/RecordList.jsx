import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRecordStore } from "@/store/recordStore.js";
import { useAuthStore } from "@/store/authStore.js";
import { formatDate, formatQty, slaTotalDays } from "@/utils/formatters.js";
import { StatusBadge } from "@/components/records/StatusBadge.jsx";
import { formatHolderLine } from "@/utils/holderDisplay.js";
import { CorrectionBadge } from "@/components/records/CorrectionBadge.jsx";
import { RecordEntryPhoto } from "@/components/records/RecordEntryPhoto.jsx";
import * as recordsApi from "@/api/records.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";
import { downloadExcelFile } from "@/utils/excelExport.js";
import { isPeerDashboardRole } from "@/utils/dashboardRoles.js";
import { useDebouncedValue } from "@/utils/useDebouncedValue.js";
import { STAGE_LABELS } from "@/pages/dashboardConstants.js";

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;

export function RecordList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const fetchAll = useRecordStore((s) => s.fetchAll);
  const records = useRecordStore((s) => s.records);
  const pagination = useRecordStore((s) => s.pagination);
  const isLoading = useRecordStore((s) => s.isLoading);
  const storeError = useRecordStore((s) => s.error);

  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [exportBusy, setExportBusy] = useState(false);
  const isBelowManager = isPeerDashboardRole(user?.role);

  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";
  const stage = searchParams.get("stage") || "";
  const vendorSearch = searchParams.get("search") || "";
  const alertLevel = searchParams.get("alert_level") || "";
  const excludeCompleted = searchParams.get("exclude_completed") === "1";
  const overdue = searchParams.get("overdue") === "1";
  const departmentId = searchParams.get("department_id") || "";

  const spKey = searchParams.toString();

  // Search fires an API call per keystroke otherwise; wait for a typing pause.
  const debouncedVendorSearch = useDebouncedValue(vendorSearch, 300);

  const patchParams = useCallback(
    (updates) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          Object.entries(updates).forEach(([key, val]) => {
            if (val === "" || val == null || val === false) n.delete(key);
            else if (val === true) n.set(key, "1");
            else n.set(key, String(val));
          });
          return n;
        },
        { replace: true },
      );
      setPage(1);
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    const n = new URLSearchParams();
    setSearchParams(n, { replace: true });
    setPage(1);
  }, [setSearchParams]);

  useEffect(() => {
    if (!isBelowManager) return;
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (next.get("alert_level") === "completed") {
      next.delete("alert_level");
      changed = true;
    }
    if (next.get("exclude_completed") === "1") {
      next.delete("exclude_completed");
      changed = true;
    }
    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [isBelowManager, searchParams, setSearchParams]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (dateFrom) n += 1;
    if (dateTo) n += 1;
    if (stage) n += 1;
    if (vendorSearch.trim()) n += 1;
    if (alertLevel) n += 1;
    if (excludeCompleted && !isBelowManager) n += 1;
    if (overdue) n += 1;
    if (departmentId) n += 1;
    return n;
  }, [
    dateFrom,
    dateTo,
    stage,
    vendorSearch,
    alertLevel,
    excludeCompleted,
    overdue,
    departmentId,
    isBelowManager,
  ]);

  useEffect(() => {
    const filters = {
      page,
      page_size: PAGE_SIZE,
    };
    if (stage) filters.stage = stage;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (debouncedVendorSearch.trim()) filters.search = debouncedVendorSearch.trim();
    if (alertLevel) filters.alert_level = alertLevel;
    if (excludeCompleted || isBelowManager) filters.exclude_completed = true;
    if (overdue) filters.overdue = true;
    if (departmentId) filters.department_id = departmentId;
    fetchAll(filters).catch(() => {});
  }, [
    page,
    spKey,
    fetchAll,
    stage,
    dateFrom,
    dateTo,
    debouncedVendorSearch,
    alertLevel,
    excludeCompleted,
    overdue,
    departmentId,
    isBelowManager,
  ]);

  const totalPages = Math.max(1, Math.ceil((pagination.count || 0) / PAGE_SIZE));

  const exportRecordsExcel = async () => {
    const token = useAuthStore.getState().accessToken;
    setExportBusy(true);
    try {
      const base = { page_size: EXPORT_PAGE_SIZE };
      if (stage) base.stage = stage;
      if (dateFrom) base.date_from = dateFrom;
      if (dateTo) base.date_to = dateTo;
      if (vendorSearch.trim()) base.search = vendorSearch.trim();
      if (alertLevel) base.alert_level = alertLevel;
      if (excludeCompleted || isBelowManager) base.exclude_completed = true;
      if (overdue) base.overdue = true;
      if (departmentId) base.department_id = departmentId;

      const all = [];
      let pageNum = 1;
      for (;;) {
        const data = await recordsApi.getAll({ ...base, page: pageNum }, token);
        const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        all.push(...results);
        if (results.length < EXPORT_PAGE_SIZE) break;
        pageNum += 1;
        if (pageNum > 200) break;
      }

      const headers = [
        "record_number",
        "vendor",
        "product_type",
        "quantity",
        "entry_date",
        "due_date",
        "sla_total_days",
        "stage",
        "alert",
        "current_holder",
      ];
      const rows = all.map((r) => {
        const sla =
          typeof r.sla_total_days === "number"
            ? r.sla_total_days
            : slaTotalDays(r.entry_date, r.due_date);
        return [
          r.record_number,
          r.vendor_name || "",
          r.product_type || "",
          formatQty(r.quantity, r.unit),
          formatDate(r.entry_date),
          formatDate(r.due_date),
          sla ?? "",
          r.current_stage,
          r.computed_alert_level || r.alert_level || "",
          formatHolderLine(r),
        ];
      });

      const stamp = new Date().toISOString().slice(0, 10);
      const saved = await downloadExcelFile(`records_export_${stamp}.xlsx`, "Records", headers, rows);
      if (saved) showToast(`Exported ${all.length} record(s).`, "success");
    } catch (e) {
      showToast(e?.message || "Export failed", "error");
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="page-records">
      <div className="page-records__head">
        <h2 className="page-records__title">Records</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn-ghost" disabled={exportBusy} onClick={() => void exportRecordsExcel()}>
            {exportBusy ? "Exporting…" : "Export Excel"}
          </button>
          {user?.role === "storeman" && !user?.must_change_password ? (
            <button type="button" className="btn btn-primary" onClick={() => navigate("/records/new")}>
              New Record
            </button>
          ) : null}
        </div>
      </div>

      {activeFilterCount > 0 ? (
        <div className="record-list-filter-banner">
          <span>
            <strong>{activeFilterCount}</strong> active filter{activeFilterCount === 1 ? "" : "s"}.
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      ) : null}

      <div className="card record-list-filters-card">
        <div className="field">
          <label>Stage</label>
          <select value={stage} onChange={(e) => patchParams({ stage: e.target.value || "" })}>
            <option value="">All</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {n} — {STAGE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Alert</label>
          <select value={alertLevel} onChange={(e) => patchParams({ alert_level: e.target.value || "" })}>
            <option value="">All</option>
            <option value="green">Green</option>
            <option value="yellow">Yellow</option>
            <option value="orange">Orange</option>
            <option value="red">Red</option>
            {!isBelowManager ? <option value="completed">Completed</option> : null}
          </select>
        </div>
        <div className="field">
          <label>Date from</label>
          <input type="date" value={dateFrom} onChange={(e) => patchParams({ date_from: e.target.value || "" })} />
        </div>
        <div className="field">
          <label>Date to</label>
          <input type="date" value={dateTo} onChange={(e) => patchParams({ date_to: e.target.value || "" })} />
        </div>
        <div className="field field--wide">
          <label>Search vendor / record</label>
          <input
            value={vendorSearch}
            placeholder="Vendor name…"
            onChange={(e) => patchParams({ search: e.target.value || "" })}
          />
        </div>
        <div className="field field--checks">
          {!isBelowManager ? (
            <label className="field-checks">
              <input
                type="checkbox"
                checked={excludeCompleted}
                onChange={(e) => patchParams({ exclude_completed: e.target.checked ? true : "" })}
              />
              Active only
            </label>
          ) : null}
          <label className="field-checks">
            <input type="checkbox" checked={overdue} onChange={(e) => patchParams({ overdue: e.target.checked ? true : "" })} />
            Overdue only
          </label>
        </div>
      </div>

      <div className="table-wrap table-wrap--raised" style={{ marginTop: "1rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Record No</th>
              <th>Vendor</th>
              <th>Product type</th>
              <th>Packaging</th>
              <th>Qty</th>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Entry</th>
              <th>Due</th>
              <th title="Total calendar days from entry to due (SLA window). Alert uses % of this window elapsed.">
                SLA days
              </th>
              <th>Stage</th>
              <th>Alert</th>
              <th>Current holder</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={14} style={{ textAlign: "center", padding: "2rem" }}>
                  <div className="spinner" style={{ margin: "0 auto" }} />
                </td>
              </tr>
            ) : null}
            {!isLoading && records.length === 0 ? (
              storeError ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: "center", padding: "2rem" }}>
                    <p style={{ color: "var(--clr-danger, #dc2626)", fontWeight: 600, marginBottom: "0.5rem" }}>
                      Could not load records
                    </p>
                    <p style={{ color: "var(--clr-text-muted, #64748b)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                      {storeError}
                    </p>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => fetchAll({ page: 1, page_size: PAGE_SIZE }).catch(() => {})}>
                      Retry
                    </button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={14} style={{ textAlign: "center", padding: "2rem" }}>
                    No records
                  </td>
                </tr>
              )
            ) : null}
            {records.map((r) => {
              const al = (r.computed_alert_level || r.alert_level || "green").toLowerCase();
              const rowCls =
                al === "red" ? "row-red" : al === "orange" ? "row-orange" : al === "yellow" ? "row-yellow" : al === "completed" ? "row-completed" : "row-green";
              const sla =
                typeof r.sla_total_days === "number"
                  ? r.sla_total_days
                  : slaTotalDays(r.entry_date, r.due_date);
              return (
                <tr
                  key={r.id}
                  className={rowCls}
                  onClick={() => navigate(`/records/${r.id}`)}
                >
                  <td>
                    {r.photo_path ? <RecordEntryPhoto recordId={r.id} variant="thumb" /> : "—"}
                  </td>
                  <td>
                    {r.record_number}
                    {r.needs_workflow_correction ? <CorrectionBadge /> : null}
                  </td>
                  <td>
                    {r.vendor_name || "—"}
                  </td>
                  <td>{r.product_type || "—"}</td>
                  <td>{r.packaging || "—"}</td>
                  <td>{formatQty(r.quantity, r.unit)}</td>
                  <td>{r.driver_name || "—"}</td>
                  <td>{r.vehicle_details || "—"}</td>
                  <td>{formatDate(r.entry_date)}</td>
                  <td>{formatDate(r.due_date)}</td>
                  <td>{sla ?? "—"}</td>
                  <td>{r.current_stage}</td>
                  <td>
                    <StatusBadge level={r.computed_alert_level || r.alert_level} />
                  </td>
                  <td style={{ fontSize: "0.9rem", lineHeight: 1.35 }}>{formatHolderLine(r)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
