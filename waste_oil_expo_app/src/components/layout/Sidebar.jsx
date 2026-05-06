import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { useUiStore } from "@/store/uiStore.js";
import appLogo from "@/assets/app-logo.png";
import {
  LayoutDashboard,
  ListChecks,
  FileText,
  Truck,
  ClipboardList,
  PlusCircle,
  ShieldCheck,
  RefreshCw,
  KeyRound,
  LogOut,
} from "lucide-react";

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const bumpPageRefresh = useUiStore((s) => s.bumpPageRefresh);
  const mustChange = Boolean(user?.must_change_password);
  const closeMenu = () => setSidebarOpen(false);

  return (
    <>
      {sidebarOpen ? <button className="sidebar-overlay" aria-label="Close menu" onClick={closeMenu} /> : null}
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
          <LayoutDashboard size={16} className="nav-icon" />
          Dashboard
        </NavLink>
        {!mustChange ? (
          <NavLink to="/queue" className={navClass} onClick={closeMenu}>
            <ListChecks size={16} className="nav-icon" />
            My Queue
          </NavLink>
        ) : null}
        <NavLink to="/records" className={navClass} onClick={closeMenu}>
          <FileText size={16} className="nav-icon" />
          Records
        </NavLink>
        {!mustChange ? (
          <NavLink to="/vendors" className={navClass} onClick={closeMenu}>
            <Truck size={16} className="nav-icon" />
            Vendors
          </NavLink>
        ) : null}
        {!mustChange && (user?.role === "manager" || user?.role === "gm") ? (
          <NavLink to="/audit-logs" className={navClass} onClick={closeMenu}>
            <ClipboardList size={16} className="nav-icon" />
            Audit Logs
          </NavLink>
        ) : null}
        {!mustChange && user?.role === "storeman" ? (
          <NavLink to="/records/new" className={navClass} onClick={closeMenu}>
            <PlusCircle size={16} className="nav-icon" />
            New Record
          </NavLink>
        ) : null}
        {!mustChange && (user?.role === "gm" || user?.role === "superadmin") ? (
          <NavLink to="/gm" className={navClass} onClick={closeMenu}>
            <ShieldCheck size={16} className="nav-icon" />
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
          onClick={() => {
            closeMenu();
            bumpPageRefresh();
          }}
        >
          <RefreshCw size={14} className="btn-icon" />
          Refresh
        </button>
        <NavLink
          to="/change-password"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: "0.75rem", width: "100%" }}
          onClick={closeMenu}
        >
          <KeyRound size={14} className="btn-icon" />
          Password
        </NavLink>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: "0.5rem", width: "100%" }}
          onClick={() => {
            closeMenu();
            logout();
          }}
        >
          <LogOut size={14} className="btn-icon" />
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
