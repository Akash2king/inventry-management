import {
  createHashRouter,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore.js";
import { AuthGuard } from "@/components/layout/AuthGuard.jsx";
import { Layout } from "@/components/layout/Layout.jsx";
import { Login } from "@/pages/Login.jsx";
import { ChangePassword } from "@/pages/ChangePassword.jsx";
import { RecordList } from "@/pages/records/RecordList.jsx";
import { RecordCreate } from "@/pages/records/RecordCreate.jsx";
import { RecordDetail } from "@/pages/records/RecordDetail.jsx";
import { RecordEdit } from "@/pages/records/RecordEdit.jsx";
import { WorkflowQueue } from "@/pages/workflow/WorkflowQueue.jsx";
import { HomeEntry } from "@/pages/HomeEntry.jsx";
import { GmConsole } from "@/pages/gm/GmConsole.jsx";
import { VendorsPage } from "@/pages/vendors/VendorsPage.jsx";

function GmOnly({ children }) {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== "gm" && role !== "superadmin") {
    return <Navigate to="/" replace />;
  }
  return children;
}

/**
 * Until password change: allow dashboard and read-only record list/detail only.
 * Backend still blocks non-GET workflow and writes (see ForcePasswordChangeMiddleware).
 */
function PasswordGate() {
  const user = useAuthStore((s) => s.user);
  const loc = useLocation();
  if (!user?.must_change_password) {
    return <Outlet />;
  }
  const p = (loc.pathname || "/").replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/records") {
    return <Outlet />;
  }
  const m = /^\/records\/([^/]+)$/.exec(p);
  if (m && m[1] !== "new") {
    return <Outlet />;
  }
  return <Navigate to="/change-password" replace />;
}

function RootShell() {
  const navigate = useNavigate();
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    restoreSession().catch(() => {});
  }, [restoreSession]);

  useEffect(() => {
    if (!window.api?.onAuthExpired) return undefined;
    const off = window.api.onAuthExpired(() => {
      logout().catch(() => {});
      navigate("/login", { replace: true });
    });
    return off;
  }, [logout, navigate]);

  useEffect(() => {
    const onForceChange = () => {
      const { user: u, setUser } = useAuthStore.getState();
      if (u) {
        setUser({ ...u, must_change_password: true });
      }
      navigate("/change-password", { replace: true });
    };
    window.addEventListener("wom:password-change-required", onForceChange);
    return () => window.removeEventListener("wom:password-change-required", onForceChange);
  }, [navigate]);

  return <Outlet />;
}

export const router = createHashRouter([
  {
    path: "/",
    element: <RootShell />,
    children: [
      { path: "login", element: <Login /> },
      {
        element: <AuthGuard />,
        children: [
          { path: "change-password", element: <ChangePassword /> },
          {
            element: <PasswordGate />,
            children: [
              {
                element: <Layout />,
                children: [
                  { index: true, element: <HomeEntry /> },
                  {
                    path: "gm",
                    element: (
                      <GmOnly>
                        <GmConsole />
                      </GmOnly>
                    ),
                  },
                  { path: "records", element: <RecordList /> },
                  { path: "vendors", element: <VendorsPage /> },
                  { path: "records/new", element: <RecordCreate /> },
                  { path: "records/:id", element: <RecordDetail /> },
                  { path: "records/:id/edit", element: <RecordEdit /> },
                  { path: "queue", element: <WorkflowQueue /> },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
