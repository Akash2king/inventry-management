import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRecordStore } from "@/store/recordStore.js";
import { useAuthStore } from "@/store/authStore.js";
import { formatDate, formatQty, diffDays } from "@/utils/formatters.js";
import { StatusBadge } from "@/components/records/StatusBadge.jsx";
import { formatHolderLine } from "@/utils/holderDisplay.js";
import { CorrectionBadge } from "@/components/records/CorrectionBadge.jsx";

const PAGE_SIZE = 20;

export function RecordList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const fetchAll = useRecordStore((s) => s.fetchAll);
  const records = useRecordStore((s) => s.records);
  const pagination = useRecordStore((s) => s.pagination);
  const isLoading = useRecordStore((s) => s.isLoading);

  const [page, setPage] = useState(1);
  const [stage, setStage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const filters = {
      page,
      page_size: PAGE_SIZE,
    };
    if (stage) filters.stage = stage;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (search.trim()) filters.search = search.trim();
    fetchAll(filters).catch(() => {});
  }, [page, stage, dateFrom, dateTo, search, fetchAll]);

  const totalPages = Math.max(1, Math.ceil((pagination.count || 0) / PAGE_SIZE));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <h2 style={{ margin: 0, color: "var(--clr-text-bright)" }}>Records</h2>
        {user?.role === "storeman" ? (
          <button type="button" className="btn btn-primary" onClick={() => navigate("/records/new")}>
            New Record
          </button>
        ) : null}
      </div>

      <div
        className="card"
        style={{
          marginTop: "1rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "0.65rem",
          alignItems: "end",
        }}
      >
        <div className="field">
          <label>Stage</label>
          <select value={stage} onChange={(e) => { setPage(1); setStage(e.target.value); }}>
            <option value="">All</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date from</label>
          <input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} />
        </div>
        <div className="field">
          <label>Date to</label>
          <input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} />
        </div>
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label>Search vendor</label>
          <input
            value={search}
            placeholder="Vendor name…"
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: "1rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Record No</th>
              <th>Vendor</th>
              <th>Product type</th>
              <th>Qty</th>
              <th>Entry</th>
              <th>Due</th>
              <th>Days</th>
              <th>Stage</th>
              <th>Alert</th>
              <th>Current holder</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "2rem" }}>
                  <div className="spinner" style={{ margin: "0 auto" }} />
                </td>
              </tr>
            ) : null}
            {!isLoading && records.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "2rem" }}>
                  No records
                </td>
              </tr>
            ) : null}
            {records.map((r) => {
              const al = (r.alert_level || "green").toLowerCase();
              const rowCls =
                al === "red" ? "row-red" : al === "yellow" ? "row-yellow" : al === "completed" ? "row-completed" : "row-green";
              const days = r.days_elapsed != null ? r.days_elapsed : diffDays(r.entry_date);
              return (
                <tr
                  key={r.id}
                  className={rowCls}
                  onClick={() => navigate(`/records/${r.id}`)}
                >
                  <td>
                    {r.record_number}
                    {r.needs_workflow_correction ? <CorrectionBadge /> : null}
                  </td>
                  <td>{r.vendor_name}</td>
                  <td>{r.product_type || "—"}</td>
                  <td>{formatQty(r.quantity, r.unit)}</td>
                  <td>{formatDate(r.entry_date)}</td>
                  <td>{formatDate(r.due_date)}</td>
                  <td>{days}</td>
                  <td>{r.current_stage}</td>
                  <td>
                    <StatusBadge level={r.alert_level} />
                  </td>
                  <td style={{ fontSize: "0.9rem", lineHeight: 1.35 }}>{formatHolderLine(r)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }}>
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
