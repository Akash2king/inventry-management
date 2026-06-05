import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="fullscreen-center">
        <div className="spinner" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
