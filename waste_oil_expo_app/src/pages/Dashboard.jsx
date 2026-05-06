import { lazy, Suspense } from "react";
import { useAuthStore } from "@/store/authStore.js";
import { isPeerDashboardRole } from "@/utils/dashboardRoles.js";
import { PageLoading } from "@/components/layout/PageLoading.jsx";

const ExecutiveDashboard = lazy(() =>
  import("@/pages/ExecutiveDashboard.jsx").then((m) => ({ default: m.ExecutiveDashboard })),
);
const PeerDashboard = lazy(() =>
  import("@/pages/PeerDashboard.jsx").then((m) => ({ default: m.PeerDashboard })),
);

export function Dashboard() {
  const role = useAuthStore((s) => s.user?.role);
  return (
    <Suspense fallback={<PageLoading />}>
      {isPeerDashboardRole(role) ? <PeerDashboard /> : <ExecutiveDashboard />}
    </Suspense>
  );
}
