import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const mustChange = Boolean(user?.must_change_password);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand__mark" aria-hidden>
          WM
        </div>
        <div>
          <div className="sidebar-brand__text">Waste</div>
          <div className="sidebar-brand__sub">Management</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={navClass}>
          Dashboard
        </NavLink>
        {!mustChange ? (
          <NavLink to="/queue" className={navClass}>
            My Queue
          </NavLink>
        ) : null}
        <NavLink to="/records" className={navClass}>
          Records
        </NavLink>
        {!mustChange ? (
          <NavLink to="/vendors" className={navClass}>
            Vendors
          </NavLink>
        ) : null}
        {!mustChange && user?.role === "storeman" ? (
          <NavLink to="/records/new" className={navClass}>
            New Record
          </NavLink>
        ) : null}
        {!mustChange && (user?.role === "gm" || user?.role === "superadmin") ? (
          <NavLink to="/gm" className={navClass}>
            GM console
          </NavLink>
        ) : null}
      </nav>
      <div className="sidebar-footer">
        <div style={{ fontWeight: 600, color: "var(--clr-text-bright)" }}>
          {user?.full_name || user?.username || "User"}
        </div>
        <span
          className="badge-completed"
          style={{ marginTop: 6, display: "inline-block", textTransform: "capitalize" }}
        >
          {user?.role || "—"}
        </span>
        <div style={{ marginTop: 6, opacity: 0.85, fontSize: "0.82rem" }}>
          {user?.department_name || "No department"}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: "0.75rem", width: "100%" }}
          onClick={() => logout()}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

function navClass({ isActive }) {
  return isActive ? "active" : "";
}
