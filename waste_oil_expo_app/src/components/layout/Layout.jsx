import { Link, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { Header } from "./Header.jsx";
import { useUiStore } from "@/store/uiStore.js";
import { useAuthStore } from "@/store/authStore.js";
import { useEffect } from "react";

export function Layout() {
  const pageRefreshNonce = useUiStore((s) => s.pageRefreshNonce);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const mustChange = useAuthStore((s) => Boolean(s.user?.must_change_password));

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setSidebarOpen]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-col">
        <Header />
        {mustChange ? (
          <div
            style={{
              margin: 0,
              padding: "0.65rem 1.25rem",
              background: "linear-gradient(90deg, rgba(251, 191, 36, 0.22), rgba(245, 158, 11, 0.12))",
              borderBottom: "1px solid rgba(217, 119, 6, 0.35)",
              fontSize: "0.9rem",
              lineHeight: 1.45,
              color: "var(--clr-text-bright)",
            }}
            role="status"
          >
            <strong>Password update required.</strong> You can review the dashboard and records (view only).{" "}
            <Link to="/change-password" style={{ fontWeight: 600 }}>
              Change your password
            </Link>{" "}
            to forward, edit, or use the rest of your role.
          </div>
        ) : null}
        <div className="page">
          <Outlet key={pageRefreshNonce} />
        </div>
      </div>
    </div>
  );
}
