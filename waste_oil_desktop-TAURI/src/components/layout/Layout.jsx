import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { Header } from "./Header.jsx";
import { ToastContainer } from "@/components/ui/ToastContainer.jsx";

export function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-col">
        <Header />
        <div className="page">
          <Outlet />
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
