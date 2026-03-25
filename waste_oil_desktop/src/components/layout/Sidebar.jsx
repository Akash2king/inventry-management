import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <NavLink to="/" end className={navClass}>
          Dashboard
        </NavLink>
        <NavLink to="/queue" className={navClass}>
          My Queue
        </NavLink>
        <NavLink to="/records" className={navClass}>
          Records
        </NavLink>
        <NavLink to="/vendors" className={navClass}>
          Vendors
        </NavLink>
        {user?.role === "storeman" ? (
          <NavLink to="/records/new" className={navClass}>
            New Record
          </NavLink>
        ) : null}
        {user?.role === "gm" || user?.role === "superadmin" ? (
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
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          {user?.department_name || "No department"}
        </div>
        <button
          type="button"
          className="btn btn-ghost"
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
