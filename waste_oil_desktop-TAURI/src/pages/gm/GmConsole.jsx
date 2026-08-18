import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { useRecordStore } from "@/store/recordStore.js";
import { useWorkflowStore } from "@/store/workflowStore.js";
import * as gmApi from "@/api/gm.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";
import { savePdfBytes } from "@/utils/pdfExport.js";
import { downloadGmReportExcel } from "@/utils/gmReportExcelExport.js";
import { useDebouncedValue } from "@/utils/useDebouncedValue.js";

/** Hierarchy roles below GM. */
const ROLE_OPTIONS = [
  { value: "storeman", label: "Storeman", layer: "peer" },
  { value: "treatment", label: "Treatment", layer: "peer" },
  { value: "admin", label: "Admin", layer: "peer" },
  { value: "manager", label: "Manager", layer: "oversight" },
];

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "All roles (hierarchy)" },
  ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: `${r.label} (${r.layer})` })),
];

function getToken() {
  return useAuthStore.getState().accessToken;
}

export function GmConsole() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const fetchAll = useRecordStore((s) => s.fetchAll);
  const pagination = useRecordStore((s) => s.pagination);
  const fetchQueue = useWorkflowStore((s) => s.fetchQueue);
  const queue = useWorkflowStore((s) => s.queue);

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const [gmTab, setGmTab] = useState("overview");
  const [modal, setModal] = useState(null);
  const [deptModal, setDeptModal] = useState(null);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedDeptUsers, setSelectedDeptUsers] = useState([]);
  const [selectedDeptUsersLoading, setSelectedDeptUsersLoading] = useState(false);
  const [userPreview, setUserPreview] = useState(null);

  const loadDeps = useCallback(async () => {
    const data = await gmApi.getDepartments(getToken());
    setDepartments(Array.isArray(data) ? data : []);
  }, []);

  const loadEmployees = useCallback(async () => {
    const filters = {};
    if (deptFilter) filters.department_id = deptFilter;
    if (roleFilter) filters.role = roleFilter;
    if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();
    const data = await gmApi.getEmployees(filters, getToken());
    setEmployees(Array.isArray(data) ? data : []);
  }, [deptFilter, roleFilter, debouncedSearch]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDeps(),
        loadEmployees(),
        fetchAll({ page_size: 5 }).catch(() => {}),
        fetchQueue().catch(() => {}),
      ]);
    } catch (e) {
      showToast(e.message || "Failed to load GM console", "error");
    } finally {
      setLoading(false);
    }
  }, [loadDeps, loadEmployees, fetchAll, fetchQueue]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    if (gmTab !== "departments" || !selectedDeptId) {
      return;
    }
    let cancelled = false;
    (async () => {
      setSelectedDeptUsersLoading(true);
      try {
        const rows = await gmApi.getEmployees({ department_id: selectedDeptId }, getToken());
        if (!cancelled) setSelectedDeptUsers(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setSelectedDeptUsers([]);
      } finally {
        if (!cancelled) setSelectedDeptUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gmTab, selectedDeptId]);

  const deptsByLayer = useMemo(() => {
    const m = new Map();
    departments.forEach((d) => {
      const layer = d.workflow_layer || "peer";
      const rows = m.get(layer) || [];
      rows.push(d);
      m.set(layer, rows);
    });
    return m;
  }, [departments]);

  const downloadReport = async (format) => {
    try {
      const params = {};
      if (reportFrom) params.from = reportFrom;
      if (reportTo) params.to = reportTo;

      if (format === "pdf") {
        const { data: pdfBytes, filename } = await gmApi.fetchMonthlyReportPdf(
          params,
          getToken(),
        );
        await savePdfBytes(pdfBytes, filename);
        showToast(
          "Monthly Inventory PDF downloaded (server report — same as monthly email).",
          "success",
        );
        return;
      }

      const data = await gmApi.getMonthlyReport(params, getToken());

      if (format === "excel") {
        const filename = `monthly_inventory_${data.period.from}_${data.period.to}.xlsx`;
        await downloadGmReportExcel(data, filename);
        showToast(
          `Monthly Inventory Excel generated for ${data.period.from} → ${data.period.to}.`,
          "success",
        );
        return;
      }
    } catch (e) {
      showToast(e.message || "Failed to load GM report", "error");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, color: "var(--clr-text-bright)" }}>GM console</h2>
        <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>{user?.full_name || user?.username}</span>
      </div>

      <p style={{ fontSize: "0.9rem", maxWidth: 720 }}>
        Manage departments and users in the workflow hierarchy. Use{" "}
        <strong>Departments</strong> to define hierarchy clusters, then{" "}
        <strong>Users &amp; hierarchy</strong> to allocate accounts by layer clusters. Manager and GM are oversight tier;
        storeman/treatment/admin are peer tier. GM-created logins receive a temporary
        password when email is configured. GM and superadmin-only accounts stay out of the employee roster.
      </p>

      <div className="gm-console-tabs" role="tablist" aria-label="GM console sections">
        {[
          { id: "overview", label: "Overview & reports" },
          { id: "departments", label: "Departments" },
          { id: "users", label: "Users & hierarchy" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={gmTab === t.id}
            aria-current={gmTab === t.id ? "true" : undefined}
            onClick={() => setGmTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!loading && departments.length === 0 ? (
        <p
          style={{
            marginBottom: "1rem",
            fontSize: "0.9rem",
            padding: "0.65rem 0.85rem",
            borderRadius: 8,
            background: "rgba(180, 120, 0, 0.12)",
            border: "1px solid rgba(180, 120, 0, 0.35)",
            color: "var(--clr-text)",
          }}
        >
          No departments found. Apply backend migrations so hierarchy departments are created:{" "}
          <code style={{ fontSize: "0.85em" }}>python manage.py migrate</code>
        </p>
      ) : null}

      {gmTab === "overview" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            <div className="card">
              <div className="kpi-label">Total records</div>
              <div className="kpi-value">{pagination.count ?? 0}</div>
            </div>
            <button
              type="button"
              className="card kpi-card-btn"
              onClick={() => navigate("/queue")}
            >
              <div className="kpi-label">Your queue (stage 5)</div>
              <div className="kpi-value">{queue.length}</div>
              <div className="kpi-hint">Open queue</div>
            </button>
            <div className="card">
              <div className="kpi-label">Departments</div>
              <div className="kpi-value">{departments.length}</div>
            </div>
            <button
              type="button"
              className="card kpi-card-btn"
              onClick={() => navigate("/records")}
              title="Browse records"
            >
              <div className="kpi-label">Open records</div>
              <div className="kpi-value">→</div>
              <div className="kpi-hint">List view</div>
            </button>
          </div>

          <div className="card" style={{ marginBottom: "1rem" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div className="kpi-label">Monthly Inventory Reports</div>
            <p style={{ margin: "0.25rem 0 0.5rem", fontSize: "0.85rem", opacity: 0.8 }}>
              PDF is generated on the <strong>server</strong> (same file as the monthly email attachment). Excel is built
              in the app from the report API.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
            <div className="field">
              <label>From</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
              />
            </div>
            <div className="field">
              <label>To</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setReportFrom("");
                setReportTo("");
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadReport("excel")}
            >
              Download Excel
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadReport("pdf")}
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>
        </>
      ) : null}

      {gmTab === "departments" ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="kpi-label">Pipeline departments</div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", opacity: 0.85 }}>
                Name, code, and layer define where users sit in the hierarchy clusters.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setDeptModal({ mode: "create" })}>
              Add department
            </button>
          </div>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Layer</th>
                  <th>Order</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>
                      <div className="spinner" style={{ margin: "0 auto" }} />
                    </td>
                  </tr>
                ) : null}
                {!loading && departments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "1rem" }}>
                      No departments yet.
                    </td>
                  </tr>
                ) : null}
                {departments.map((d) => (
                  <Fragment key={d.id}>
                    <tr
                      onClick={() =>
                        setSelectedDeptId((prev) => (String(prev) === String(d.id) ? "" : String(d.id)))
                      }
                      style={{
                        cursor: "pointer",
                        background: String(d.id) === String(selectedDeptId) ? "rgba(21, 101, 192, 0.08)" : undefined,
                      }}
                      title="Expand/collapse users in this department"
                    >
                      <td>{d.name}</td>
                      <td>{d.code}</td>
                      <td style={{ textTransform: "capitalize" }}>{d.workflow_layer || "peer"}</td>
                      <td>{d.stage_order}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeptModal({ mode: "edit", row: d });
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                    {String(d.id) === String(selectedDeptId) ? (
                      <tr>
                        <td colSpan={5} style={{ background: "rgba(21, 101, 192, 0.04)" }}>
                          <div style={{ padding: "0.65rem 0.3rem" }}>
                            <div className="kpi-label" style={{ marginBottom: "0.45rem" }}>
                              Users in {d.name}
                            </div>
                            <div className="table-wrap">
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Username</th>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Active</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedDeptUsersLoading ? (
                                    <tr>
                                      <td colSpan={4} style={{ textAlign: "center", padding: "0.9rem" }}>
                                        <div className="spinner" style={{ margin: "0 auto" }} />
                                      </td>
                                    </tr>
                                  ) : null}
                                  {!selectedDeptUsersLoading && selectedDeptUsers.length === 0 ? (
                                    <tr>
                                      <td colSpan={4} style={{ textAlign: "center", padding: "0.9rem" }}>
                                        No users in this department.
                                      </td>
                                    </tr>
                                  ) : null}
                                  {selectedDeptUsers.map((u) => (
                                    <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => setUserPreview(u)}>
                                      <td>{u.username}</td>
                                      <td>{u.full_name || "—"}</td>
                                      <td style={{ textTransform: "capitalize" }}>{u.role}</td>
                                      <td>{u.is_active ? "Yes" : "No"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {gmTab === "users" ? (
        <>
          <div className="gm-graph" aria-label="Users by hierarchy clusters">
            <div className="gm-graph-cluster gm-graph-cluster--peer">
              <h4>Peer cluster</h4>
              <p className="gm-graph-cluster__meta">
                Departments: {(deptsByLayer.get("peer") || []).map((d) => d.code).join(", ") || "—"}
              </p>
              <div className="gm-graph-nodes">
                {employees
                  .filter((e) => (e.department_workflow_layer || "peer") === "peer")
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="gm-graph-node gm-graph-node--peer"
                      onClick={() => setUserPreview(e)}
                      title={`${e.full_name || e.username} (${e.role})`}
                    >
                      <span>{e.full_name || e.username}</span>
                      <small>{e.role}</small>
                    </button>
                  ))}
              </div>
            </div>
            <div className="gm-graph-link" aria-hidden>
              <span />
            </div>
            <div className="gm-graph-cluster gm-graph-cluster--oversight">
              <h4>Oversight cluster</h4>
              <p className="gm-graph-cluster__meta">
                Departments: {(deptsByLayer.get("oversight") || []).map((d) => d.code).join(", ") || "—"}
              </p>
              <div className="gm-graph-nodes">
                {employees
                  .filter((e) => (e.department_workflow_layer || "peer") === "oversight")
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="gm-graph-node gm-graph-node--oversight"
                      onClick={() => setUserPreview(e)}
                      title={`${e.full_name || e.username} (${e.role})`}
                    >
                      <span>{e.full_name || e.username}</span>
                      <small>{e.role}</small>
                    </button>
                  ))}
              </div>
            </div>
          </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div className="field">
            <label>Department</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ minWidth: 0, width: "100%" }}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code}) — {(d.workflow_layer || "peer")} / order {d.stage_order}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ minWidth: 0, width: "100%" }}
            >
              {ROLE_FILTER_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 12rem", minWidth: 0 }}>
            <label>Search</label>
            <input
              placeholder="Username, email, name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => refresh()}>
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setModal({ mode: "create", deptsByLayer, initialRole: "admin" })}
          >
            Add admin
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ mode: "create", deptsByLayer })}
          >
            Add user
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Layer</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                  <div className="spinner" style={{ margin: "0 auto" }} />
                </td>
              </tr>
            ) : null}
            {!loading && employees.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "1.5rem" }}>
                  No employees match this filter.
                </td>
              </tr>
            ) : null}
            {employees.map((row) => (
              <tr
                key={row.id}
                onClick={() => setUserPreview(row)}
                style={{ cursor: "pointer" }}
                title="User details"
              >
                <td>{row.username}</td>
                <td>{row.email}</td>
                <td>{row.full_name || "—"}</td>
                <td style={{ textTransform: "capitalize" }}>{row.role}</td>
                <td>{row.department_name || "—"}</td>
                <td style={{ textTransform: "capitalize" }}>{row.department_workflow_layer || "—"}</td>
                <td>{row.is_active ? "Yes" : "No"}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                    onClick={() => setModal({ mode: "edit", row, deptsByLayer })}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      ) : null}

      {userPreview ? (
        <UserCardModal
          row={userPreview}
          onClose={() => setUserPreview(null)}
          onEdit={() => {
            const row = userPreview;
            setUserPreview(null);
            setModal({ mode: "edit", row, deptsByLayer });
          }}
        />
      ) : null}

      {modal ? (
        <EmployeeModal
          key={`${modal.mode}-${modal.row?.id ?? "new"}-${modal.initialRole ?? ""}`}
          mode={modal.mode}
          row={modal.row}
          initialRole={modal.initialRole}
          deptsByLayer={modal.deptsByLayer}
          departments={departments}
          currentUserId={user?.id ? String(user.id) : ""}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            loadEmployees().catch(() => {});
          }}
          onDeleted={(removedId) => {
            setModal(null);
            setUserPreview((p) =>
              p && String(p.id) === String(removedId) ? null : p,
            );
            loadEmployees().catch(() => {});
          }}
        />
      ) : null}

      {deptModal ? (
        <DepartmentModal
          key={`${deptModal.mode}-${deptModal.row?.id ?? "new"}`}
          mode={deptModal.mode}
          row={deptModal.row}
          viewerRole={user?.role}
          onClose={() => setDeptModal(null)}
          onSaved={() => {
            setDeptModal(null);
            Promise.all([loadDeps(), loadEmployees()]).catch(() => {});
          }}
        />
      ) : null}
    </div>
  );
}

function UserCardModal({ row, onClose, onEdit }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{row.full_name || row.username}</h3>
        <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", opacity: 0.8 }}>User</p>
        <dl
          style={{
            margin: 0,
            display: "grid",
            gap: "0.65rem",
            fontSize: "0.92rem",
          }}
        >
          <div>
            <dt style={{ fontSize: "0.72rem", textTransform: "uppercase", opacity: 0.65, marginBottom: 2 }}>Username</dt>
            <dd style={{ margin: 0 }}>{row.username}</dd>
          </div>
          <div>
            <dt style={{ fontSize: "0.72rem", textTransform: "uppercase", opacity: 0.65, marginBottom: 2 }}>Email</dt>
            <dd style={{ margin: 0 }}>{row.email || "—"}</dd>
          </div>
          <div>
            <dt style={{ fontSize: "0.72rem", textTransform: "uppercase", opacity: 0.65, marginBottom: 2 }}>Role</dt>
            <dd style={{ margin: 0, textTransform: "capitalize" }}>{row.role || "—"}</dd>
          </div>
          <div>
            <dt style={{ fontSize: "0.72rem", textTransform: "uppercase", opacity: 0.65, marginBottom: 2 }}>Department</dt>
            <dd style={{ margin: 0 }}>{row.department_name || "—"}</dd>
          </div>
          <div>
            <dt style={{ fontSize: "0.72rem", textTransform: "uppercase", opacity: 0.65, marginBottom: 2 }}>Layer</dt>
            <dd style={{ margin: 0, textTransform: "capitalize" }}>{row.department_workflow_layer || "—"}</dd>
          </div>
          <div>
            <dt style={{ fontSize: "0.72rem", textTransform: "uppercase", opacity: 0.65, marginBottom: 2 }}>Active</dt>
            <dd style={{ margin: 0 }}>{row.is_active ? "Yes" : "No"}</dd>
          </div>
        </dl>
        <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeModal({
  mode,
  row,
  initialRole,
  deptsByLayer,
  departments,
  currentUserId,
  onClose,
  onSaved,
  onDeleted,
}) {
  const [username, setUsername] = useState(row?.username || "");
  const [email, setEmail] = useState(row?.email || "");
  const [fullName, setFullName] = useState(row?.full_name || "");
  const [role, setRole] = useState(row?.role || initialRole || "storeman");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(row?.is_active !== false);
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const isSelf = mode === "edit" && row?.id && currentUserId && String(row.id) === String(currentUserId);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedLayer = ROLE_OPTIONS.find((r) => r.value === role)?.layer ?? "peer";
  const departmentId = useMemo(() => {
    const map = deptsByLayer instanceof Map ? deptsByLayer : null;
    const rows = map?.get(selectedLayer) || [];
    const d = rows[0];
    return d ? String(d.id) : "";
  }, [deptsByLayer, selectedLayer]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "create") {
        if (!password || password.length < 8) {
          showToast("Password must be at least 8 characters.", "error");
          setBusy(false);
          return;
        }
        if (!departmentId) {
          showToast("No department for this role — seed departments first.", "error");
          setBusy(false);
          return;
        }
        await gmApi.createEmployee(
          {
            username,
            email,
            full_name: fullName,
            role,
            department: departmentId,
            password,
            is_active: isActive,
          },
          getToken()
        );
        showToast("Employee created", "success");
      } else {
        const payload = {
          email,
          full_name: fullName,
          role,
          is_active: isActive,
        };
        if (password.length >= 8) {
          payload.password = password;
        }
        const layer = ROLE_OPTIONS.find((r) => r.value === role)?.layer ?? "peer";
        const rows = deptsByLayer instanceof Map ? deptsByLayer.get(layer) || [] : [];
        const d = rows[0];
        if (d) payload.department = String(d.id);
        await gmApi.updateEmployee(row.id, payload, getToken());
        showToast("Employee updated", "success");
      }
      onSaved();
    } catch (err) {
      showToast(err.message || "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser() {
    if (mode !== "edit" || !row?.id) return;
    if (
      !window.confirm(
        `Permanently remove user "${row.username}"? This cannot be undone. Records they held will keep history; current holder is cleared if it was them.`,
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    try {
      await gmApi.deleteEmployee(row.id, getToken());
      showToast("User removed", "success");
      onDeleted(row.id);
    } catch (err) {
      showToast(err.message || "Remove failed", "error");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <h3 style={{ marginTop: 0 }}>{mode === "create" ? "New employee" : `Edit ${row.username}`}</h3>
        <form onSubmit={submit} className="grid-form">
          {mode === "create" ? (
            <div className="field">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          ) : (
            <div className="field">
              <label>Username</label>
              <input value={username} readOnly disabled />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} ({o.layer})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Department (auto)</label>
            <input
              readOnly
              value={
                departmentId
                  ? departments.find((x) => String(x.id) === departmentId)?.name || departmentId
                  : "—"
              }
            />
          </div>
          <div className="field">
            <label>{mode === "create" ? "Password" : "New password (optional)"}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "create" ? "Min 8 characters" : "Leave blank to keep"}
            />
          </div>
          <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              id="active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="active">Active</label>
          </div>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {mode === "edit" && !isSelf ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: "var(--clr-danger, #b42318)" }}
                disabled={busy || deleteBusy}
                onClick={() => void removeUser()}
              >
                {deleteBusy ? "Removing…" : "Remove user"}
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy || deleteBusy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function DepartmentModal({ mode, row, viewerRole, onClose, onSaved }) {
  const maxOrder = viewerRole === "gm" ? 4 : 99;
  const [name, setName] = useState(mode === "edit" ? row?.name ?? "" : "");
  const [code, setCode] = useState(mode === "edit" ? row?.code ?? "" : "");
  const [stageOrder, setStageOrder] = useState(mode === "edit" ? row?.stage_order ?? 1 : 1);
  const [workflowLayer, setWorkflowLayer] = useState(
    mode === "edit" ? row?.workflow_layer ?? "peer" : "peer"
  );
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    const st = Number(stageOrder);
    if (Number.isNaN(st) || st < 1) {
      showToast("Stage order must be at least 1.", "error");
      return;
    }
    if (st > maxOrder) {
      showToast(`GM may only assign order values 1–${maxOrder}.`, "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        stage_order: st,
        workflow_layer: workflowLayer,
      };
      if (!payload.name || !payload.code) {
        showToast("Name and code are required.", "error");
        setBusy(false);
        return;
      }
      if (mode === "create") {
        await gmApi.createDepartment(payload, getToken());
        showToast("Department created", "success");
      } else {
        await gmApi.updateDepartment(row.id, payload, getToken());
        showToast("Department updated", "success");
      }
      onSaved();
    } catch (err) {
      showToast(err.message || "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeDept() {
    if (mode !== "edit" || !row?.id) return;
    if (!window.confirm(`Delete department "${row.name}"? Users or history may block this.`)) return;
    setDeleteBusy(true);
    try {
      await gmApi.deleteDepartment(row.id, getToken());
      showToast("Department removed", "success");
      onSaved();
    } catch (err) {
      showToast(err.message || "Delete failed", "error");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <h3 style={{ marginTop: 0 }}>
          {mode === "create" ? "New department" : `Edit ${row?.name || "department"}`}
        </h3>
        <form onSubmit={submit} className="grid-form">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </div>
          <div className="field">
            <label>Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={10}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div className="field">
            <label>Hierarchy layer</label>
            <select value={workflowLayer} onChange={(e) => setWorkflowLayer(e.target.value)}>
              <option value="peer">Peer cluster (storeman/treatment/admin)</option>
              <option value="oversight">Oversight cluster (manager/gm)</option>
            </select>
          </div>
          <div className="field">
            <label>Order within layer</label>
            <input
              type="number"
              min={1}
              max={maxOrder}
              value={stageOrder}
              onChange={(e) => setStageOrder(e.target.value)}
            />
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", opacity: 0.75 }}>
              {viewerRole === "gm" ? `GM accounts: order range 1–${maxOrder}.` : "Superadmin may use any order value."}
            </p>
          </div>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {mode === "edit" ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: "var(--clr-danger, #b42318)" }}
                disabled={busy || deleteBusy}
                onClick={() => void removeDept()}
              >
                {deleteBusy ? "Removing…" : "Delete department"}
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy || deleteBusy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
