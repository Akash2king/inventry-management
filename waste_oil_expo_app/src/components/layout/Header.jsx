import { useAuthStore } from "@/store/authStore.js";
import { useUiStore } from "@/store/uiStore.js";
import { ToastContainer } from "@/components/ui/ToastContainer.jsx";
import appLogo from "@/assets/app-logo.png";
import { Menu } from "lucide-react";

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
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <header className="header-bar">
      <div className="header-bar__brand">
        <button
          type="button"
          className="btn btn-ghost btn-sm header-menu-btn"
          onClick={toggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={16} className="btn-icon" />
          <span>Menu</span>
        </button>
        <img src={appLogo} alt="App logo" className="header-bar__logo" />
        <h1>Chem-Solv Inventory</h1>
        <ToastContainer />
      </div>
      <div className="header-user">
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
      </div>
    </header>
  );
}
