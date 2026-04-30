import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { useUiStore } from "@/store/uiStore.js";
import { ToastContainer } from "@/components/ui/ToastContainer.jsx";
import appLogo from "@/assets/app-logo.png";

function initials(user) {
  const n = user?.full_name || user?.username || "?";
  const parts = String(n).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return n.slice(0, 2).toUpperCase();
}

export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const bumpPageRefresh = useUiStore((s) => s.bumpPageRefresh);

  return (
    <header className="header-bar">
      <div className="header-bar__brand">
        <img src={appLogo} alt="App logo" className="header-bar__logo" />
        <h1>Chem-Solv Inventory</h1>
        <ToastContainer />
      </div>
      <div className="header-user">
        <button
          type="button"
          className="btn btn-ghost btn-sm header-refresh"
          title="Reload data for this page"
          aria-label="Refresh page data"
          onClick={() => bumpPageRefresh()}
        >
          Refresh
        </button>
        <div className="header-user__meta">
          <span className="header-user__name">{user?.full_name || user?.username || "User"}</span>
          <span className="header-user__role">
            {user?.username ? `@${user.username}` : ""}
            {user?.role ? (user?.username ? ` • ${user.role}` : user.role) : ""}
          </span>
        </div>
        <div className="header-user__avatar" aria-hidden>
          {initials(user)}
        </div>
        <Link to="/change-password" className="btn btn-ghost btn-sm" title="Change your password">
          Password
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => logout()}>
          Logout
        </button>
      </div>
    </header>
  );
}
