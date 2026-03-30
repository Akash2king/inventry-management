import { useAuthStore } from "@/store/authStore.js";

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

  return (
    <header className="header-bar">
      <h1>Waste Management</h1>
      <div className="header-user">
        <div className="header-user__meta">
          <span className="header-user__name">{user?.full_name || user?.username || "User"}</span>
          <span className="header-user__role">{user?.role || ""}</span>
        </div>
        <div className="header-user__avatar" aria-hidden>
          {initials(user)}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => logout()}>
          Logout
        </button>
      </div>
    </header>
  );
}
