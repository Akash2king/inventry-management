import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { useRecordStore } from "@/store/recordStore.js";
import { useWorkflowStore } from "@/store/workflowStore.js";
import * as gmApi from "@/api/gm.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";

/** Pipeline roles below GM (stages 1–4). GM / superadmin are not managed here. */
const ROLE_OPTIONS = [
  { value: "storeman", label: "Storeman", stage: 1 },
  { value: "treatment", label: "Treatment", stage: 2 },
  { value: "admin", label: "Admin", stage: 3 },
  { value: "manager", label: "Manager", stage: 4 },
];

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "All roles (hierarchy)" },
  ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: `${r.label} (stage ${r.stage})` })),
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

  const [modal, setModal] = useState(null);
  const [userPreview, setUserPreview] = useState(null);

  const loadDeps = useCallback(async () => {
    const data = await gmApi.getDepartments(getToken());
    setDepartments(Array.isArray(data) ? data : []);
  }, []);

  const loadEmployees = useCallback(async () => {
    const filters = {};
    if (deptFilter) filters.department_id = deptFilter;
    if (roleFilter) filters.role = roleFilter;
    if (search.trim()) filters.search = search.trim();
    const data = await gmApi.getEmployees(filters, getToken());
    setEmployees(Array.isArray(data) ? data : []);
  }, [deptFilter, roleFilter, search]);

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

  const deptByStage = useMemo(() => {
    const m = new Map();
    departments.forEach((d) => m.set(d.stage_order, d));
    return m;
  }, [departments]);

  const adminCount = useMemo(
    () => employees.filter((e) => e.role === "admin").length,
    [employees]
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, color: "var(--clr-text-bright)" }}>GM console</h2>
        <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>{user?.full_name || user?.username}</span>
      </div>

      <p style={{ fontSize: "0.9rem", maxWidth: 720 }}>
        Manage users below GM in the hierarchy: Storeman → Treatment → Admin → Manager (stages 1–4). List and
        create Admin and other pipeline logins; the department is picked automatically from the role. GM and
        superadmin accounts are not listed or created here.
      </p>
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
          No departments found. Apply backend migrations so pipeline departments (stages 1–5) are created:{" "}
          <code style={{ fontSize: "0.85em" }}>python manage.py migrate</code>
        </p>
      ) : null}

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
          onClick={() => setRoleFilter((r) => (r === "admin" ? "" : "admin"))}
          title="Toggle filter: admins only"
        >
          <div className="kpi-label">Admins (stage 3)</div>
          <div className="kpi-value">{adminCount}</div>
          <div className="kpi-hint">{roleFilter === "admin" ? "Clear filter" : "Show admins"}</div>
        </button>
        <div className="card">
          <div className="kpi-label">Users (this list)</div>
          <div className="kpi-value">{employees.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div className="field">
            <label>Department</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ minWidth: 200 }}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code}) — stage {d.stage_order}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ minWidth: 200 }}
            >
              {ROLE_FILTER_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 200px" }}>
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
            onClick={() => setModal({ mode: "create", deptByStage, initialRole: "admin" })}
          >
            Add admin
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ mode: "create", deptByStage })}
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
              <th>Stage</th>
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
                <td>{row.department_stage_order ?? "—"}</td>
                <td>{row.is_active ? "Yes" : "No"}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                    onClick={() => setModal({ mode: "edit", row, deptByStage })}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {userPreview ? (
        <UserCardModal
          row={userPreview}
          onClose={() => setUserPreview(null)}
          onEdit={() => {
            const row = userPreview;
            setUserPreview(null);
            setModal({ mode: "edit", row, deptByStage });
          }}
        />
      ) : null}

      {modal ? (
        <EmployeeModal
          key={`${modal.mode}-${modal.row?.id ?? "new"}-${modal.initialRole ?? ""}`}
          mode={modal.mode}
          row={modal.row}
          initialRole={modal.initialRole}
          deptByStage={modal.deptByStage}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            loadEmployees().catch(() => {});
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
            <dt style={{ fontSize: "0.72rem", textTransform: "uppercase", opacity: 0.65, marginBottom: 2 }}>Stage</dt>
            <dd style={{ margin: 0 }}>{row.department_stage_order ?? "—"}</dd>
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

function EmployeeModal({ mode, row, initialRole, deptByStage, departments, onClose, onSaved }) {
  const [username, setUsername] = useState(row?.username || "");
  const [email, setEmail] = useState(row?.email || "");
  const [fullName, setFullName] = useState(row?.full_name || "");
  const [role, setRole] = useState(row?.role || initialRole || "storeman");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(row?.is_active !== false);
  const [busy, setBusy] = useState(false);

  const selectedStage = ROLE_OPTIONS.find((r) => r.value === role)?.stage ?? 1;
  const departmentId = useMemo(() => {
    const map = deptByStage instanceof Map ? deptByStage : null;
    const d = map?.get(selectedStage);
    return d ? String(d.id) : "";
  }, [deptByStage, selectedStage]);

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
        const stage = ROLE_OPTIONS.find((r) => r.value === role)?.stage ?? 1;
        const d =
          deptByStage instanceof Map ? deptByStage.get(stage) : undefined;
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

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" onClick={(ev) => ev.stopPropagation()}>
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
                  {o.label} (stage {o.stage})
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
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
