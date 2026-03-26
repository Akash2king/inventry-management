import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { Dashboard } from "@/pages/Dashboard.jsx";

export function HomeEntry() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === "gm" || role === "superadmin") {
    return <Navigate to="/gm" replace />;
  }
  return <Dashboard />;
}
