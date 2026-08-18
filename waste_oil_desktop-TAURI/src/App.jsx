import { RouterProvider } from "react-router-dom";
import { router } from "./router.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
