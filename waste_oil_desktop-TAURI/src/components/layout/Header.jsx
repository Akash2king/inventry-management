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
      <h1>Waste Oil Manager</h1>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--clr-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "var(--clr-text-bright)",
          }}
        >
          {initials(user)}
        </div>
        <span style={{ fontSize: "0.85rem", textTransform: "capitalize" }}>
          {user?.role || ""}
        </span>
        <button type="button" className="btn btn-ghost" onClick={() => logout()}>
          Logout
        </button>
      </div>
    </header>
  );
}
