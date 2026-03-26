import { useUiStore } from "@/store/uiStore.js";
import { Toast } from "./Toast.jsx";

export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} />
      ))}
    </div>
  );
}

export function showToast(message, type) {
  useUiStore.getState().showToast(message, type);
}
