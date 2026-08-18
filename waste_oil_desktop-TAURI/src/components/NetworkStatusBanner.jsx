import { useEffect, useState } from "react";

export function NetworkStatusBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      style={{
        margin: 0,
        padding: "0.55rem 1.25rem",
        background: "rgba(220, 38, 38, 0.14)",
        borderBottom: "1px solid rgba(220, 38, 38, 0.35)",
        fontSize: "0.88rem",
        lineHeight: 1.4,
        color: "var(--clr-text-bright)",
      }}
    >
      You are offline — some features may be unavailable.
    </div>
  );
}
