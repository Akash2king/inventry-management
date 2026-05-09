import { lazy, Suspense, useEffect } from "react";
import {
  createHashRouter,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { AuthGuard } from "@/components/layout/AuthGuard.jsx";
import { Layout } from "@/components/layout/Layout.jsx";
import { PageLoading } from "@/components/layout/PageLoading.jsx";

/** Named-export pages → lazy (smaller cold start for packaged EXE). */
const Login = lazy(() => import("@/pages/Login.jsx").then((m) => ({ default: m.Login })));
const ChangePassword = lazy(() =>
  import("@/pages/ChangePassword.jsx").then((m) => ({ default: m.ChangePassword })),
);
const HomeEntry = lazy(() => import("@/pages/HomeEntry.jsx").then((m) => ({ default: m.HomeEntry })));
const GmConsole = lazy(() => import("@/pages/gm/GmConsole.jsx").then((m) => ({ default: m.GmConsole })));
const RecordList = lazy(() => import("@/pages/records/RecordList.jsx").then((m) => ({ default: m.RecordList })));
const RecordCreate = lazy(() =>
  import("@/pages/records/RecordCreate.jsx").then((m) => ({ default: m.RecordCreate })),
);
const RecordDetail = lazy(() =>
  import("@/pages/records/RecordDetail.jsx").then((m) => ({ default: m.RecordDetail })),
);
const RecordEdit = lazy(() => import("@/pages/records/RecordEdit.jsx").then((m) => ({ default: m.RecordEdit })));
const WorkflowQueue = lazy(() =>
  import("@/pages/workflow/WorkflowQueue.jsx").then((m) => ({ default: m.WorkflowQueue })),
);
const VendorsPage = lazy(() =>
  import("@/pages/vendors/VendorsPage.jsx").then((m) => ({ default: m.VendorsPage })),
);
const AuditLogPage = lazy(() =>
  import("@/pages/audit/AuditLogPage.jsx").then((m) => ({ default: m.AuditLogPage })),
);
const SecuritySessionsPage = lazy(() =>
  import("@/pages/security/SecuritySessionsPage.jsx").then((m) => ({
    default: m.SecuritySessionsPage,
  })),
);
const InAppNotificationsPage = lazy(() =>
  import("@/pages/security/InAppNotificationsPage.jsx").then((m) => ({
    default: m.InAppNotificationsPage,
  })),
);

function SuspensePage({ children }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}

function GmOnly({ children }) {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== "gm" && role !== "superadmin") {
    return <Navigate to="/" replace />;
  }
  return children;
}

function ManagerOrGmOnly({ children }) {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== "manager" && role !== "gm") {
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
  if (p === "/" || p === "/records" || p === "/sessions" || p === "/notifications") {
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
      {
        path: "login",
        element: (
          <SuspensePage>
            <Login />
          </SuspensePage>
        ),
      },
      {
        element: <AuthGuard />,
        children: [
          {
            path: "change-password",
            element: (
              <SuspensePage>
                <ChangePassword />
              </SuspensePage>
            ),
          },
          {
            element: <PasswordGate />,
            children: [
              {
                element: <Layout />,
                children: [
                  {
                    index: true,
                    element: (
                      <SuspensePage>
                        <HomeEntry />
                      </SuspensePage>
                    ),
                  },
                  {
                    path: "gm",
                    element: (
                      <GmOnly>
                        <SuspensePage>
                          <GmConsole />
                        </SuspensePage>
                      </GmOnly>
                    ),
                  },
                  {
                    path: "records",
                    element: (
                      <SuspensePage>
                        <RecordList />
                      </SuspensePage>
                    ),
                  },
                  {
                    path: "vendors",
                    element: (
                      <SuspensePage>
                        <VendorsPage />
                      </SuspensePage>
                    ),
                  },
                  {
                    path: "audit-logs",
                    element: (
                      <ManagerOrGmOnly>
                        <SuspensePage>
                          <AuditLogPage />
                        </SuspensePage>
                      </ManagerOrGmOnly>
                    ),
                  },
                  {
                    path: "records/new",
                    element: (
                      <SuspensePage>
                        <RecordCreate />
                      </SuspensePage>
                    ),
                  },
                  {
                    path: "records/:id",
                    element: (
                      <SuspensePage>
                        <RecordDetail />
                      </SuspensePage>
                    ),
                  },
                  {
                    path: "records/:id/edit",
                    element: (
                      <SuspensePage>
                        <RecordEdit />
                      </SuspensePage>
                    ),
                  },
                  {
                    path: "queue",
                    element: (
                      <SuspensePage>
                        <WorkflowQueue />
                      </SuspensePage>
                    ),
                  },
                  {
                    path: "sessions",
                    element: (
                      <SuspensePage>
                        <SecuritySessionsPage />
                      </SuspensePage>
                    ),
                  },
                  {
                    path: "notifications",
                    element: (
                      <SuspensePage>
                        <InAppNotificationsPage />
                      </SuspensePage>
                    ),
                  },
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
