import { createHashRouter, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore.js";
import { AuthGuard } from "@/components/layout/AuthGuard.jsx";
import { Layout } from "@/components/layout/Layout.jsx";
import { Login } from "@/pages/Login.jsx";
import { RecordList } from "@/pages/records/RecordList.jsx";
import { RecordCreate } from "@/pages/records/RecordCreate.jsx";
import { RecordDetail } from "@/pages/records/RecordDetail.jsx";
import { RecordEdit } from "@/pages/records/RecordEdit.jsx";
import { WorkflowQueue } from "@/pages/workflow/WorkflowQueue.jsx";
import { HomeEntry } from "@/pages/HomeEntry.jsx";
import { GmConsole } from "@/pages/gm/GmConsole.jsx";
import { VendorsPage } from "@/pages/vendors/VendorsPage.jsx";
import { Navigate } from "react-router-dom";

function GmOnly({ children }) {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== "gm" && role !== "superadmin") {
    return <Navigate to="/" replace />;
  }
  return children;
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
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
