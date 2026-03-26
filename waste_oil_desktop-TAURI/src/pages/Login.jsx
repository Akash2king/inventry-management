import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";

export function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      const msg = String(err.message || "");
      if (msg.includes("401") || msg.toLowerCase().includes("invalid")) {
        setError("Invalid credentials");
      } else {
        setError(msg || "Sign in failed");
      }
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="fullscreen-center">
        <div className="spinner" />
      </div>
    );
  }

  if (typeof window !== "undefined" && !window.api) {
    return (
      <div className="fullscreen-center">
        <div className="card">
          <p style={{ marginTop: 0 }}>API bridge is not available.</p>
          <p style={{ fontSize: "0.9rem", opacity: 0.9 }}>
            Set <code>VITE_API_BASE_URL</code> in <code>.env</code> (see <code>.env.example</code>)
            so the browser/Tauri API shim can load, then run <code>npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fullscreen-center">
      <div className="card" style={{ width: "min(400px, 92vw)" }}>
        <h2 style={{ marginTop: 0, color: "var(--clr-text-bright)" }}>Sign In</h2>
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="u">Username</label>
            <input
              id="u"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div className="field" style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="p">Password</label>
            <input
              id="p"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          {error ? (
            <div className="field-error" style={{ marginBottom: "0.75rem" }}>
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
