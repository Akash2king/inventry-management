import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { useUiStore } from "@/store/uiStore.js";
import appLogo from "@/assets/app-logo.png";

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const mustChange = Boolean(user?.must_change_password);
  const closeMenu = () => setSidebarOpen(false);

  return (
    <>
      {sidebarOpen ? (
        <button className="sidebar-overlay" aria-label="Close menu" onClick={closeMenu} />
      ) : null}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar-brand">
          <img src={appLogo} className="sidebar-brand__logo" alt="App logo" />
          <div>
            <div className="sidebar-brand__text">Chem-Solv</div>
            <div className="sidebar-brand__sub">Inventory</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={navClass} onClick={closeMenu}>
            Dashboard
          </NavLink>
          {!mustChange ? (
            <NavLink to="/queue" className={navClass} onClick={closeMenu}>
              My Queue
            </NavLink>
          ) : null}
          <NavLink to="/records" className={navClass} onClick={closeMenu}>
            Records
          </NavLink>
          {!mustChange ? (
            <NavLink to="/vendors" className={navClass} onClick={closeMenu}>
              Vendors
            </NavLink>
          ) : null}
          {!mustChange && (user?.role === "manager" || user?.role === "gm") ? (
            <NavLink to="/audit-logs" className={navClass} onClick={closeMenu}>
              Audit Logs
            </NavLink>
          ) : null}
          {!mustChange && user?.role === "storeman" ? (
            <NavLink to="/records/new" className={navClass} onClick={closeMenu}>
              New Record
            </NavLink>
          ) : null}
          {!mustChange && (user?.role === "gm" || user?.role === "superadmin") ? (
            <NavLink to="/gm" className={navClass} onClick={closeMenu}>
              GM console
            </NavLink>
          ) : null}
          <NavLink to="/sessions" className={navClass} onClick={closeMenu}>
            Devices
          </NavLink>
          <NavLink to="/notifications" className={navClass} onClick={closeMenu}>
            Workflow notifications
          </NavLink>
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
            onClick={() => {
              closeMenu();
              logout();
            }}
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

function navClass({ isActive }) {
  return isActive ? "active" : "";
}
