import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { humanizeApiErrorBody } from "@/utils/apiErrors.js";
import { loadSavedApiBase } from "@/platform/apiConfig.js";
import "./login.css";

function IconUser() {
  return (
    <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function IconLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.25c-2.8 3.5-5 6.8-5 10.25a5 5 0 1 0 10 0c0-3.45-2.2-6.75-5-10.25Z"
        fill="url(#loginLogoGrad)"
      />
      <defs>
        <linearGradient id="loginLogoGrad" x1="7" y1="2" x2="17" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3578e5" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 1 21h22L12 2Zm0 15a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm-1-9v6h2V8h-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const apiBase = loadSavedApiBase();
  const hasApi = Boolean(typeof window !== "undefined" && window.api);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  function friendlyLoginMessage(raw) {
    const msg = String(raw || "").trim();
    if (!msg) return "Sign in failed";
    const lower = msg.toLowerCase();
    if (msg.includes("401") || lower.includes("no active account") || lower.includes("invalid")) {
      return "Invalid username or password.";
    }
    if (lower.includes("password") && lower.includes("blank")) {
      return "Please enter your password.";
    }
    if (lower.includes("username") && lower.includes("blank")) {
      return "Please enter your username.";
    }
    return msg;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const u = username.trim();
    const p = password;
    if (!window.api) {
      setError("Set API base URL first. Open Connection settings.");
      return;
    }
    if (!u) {
      setError("Please enter your username.");
      return;
    }
    if (!p) {
      setError("Please enter your password.");
      return;
    }
    setBusy(true);
    try {
      await login(u, p);
      navigate("/", { replace: true });
    } catch (err) {
      let msg = String(err?.message || "");
      if (msg.startsWith("{")) {
        try {
          msg = humanizeApiErrorBody(JSON.parse(msg));
        } catch {
          /* keep msg */
        }
      }
      setError(friendlyLoginMessage(msg));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="login-page">
        <div className="login-page__bg" aria-hidden />
        <div className="login-page__shell" style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (typeof window !== "undefined" && !window.api) {
    return (
      <div className="login-page">
        <div className="login-page__bg" aria-hidden />
        <div className="login-page__shell">
          <div className="login-card">
            <h2 className="login-card__title" style={{ textAlign: "center" }}>
              Set backend URL first
            </h2>
            <p className="login-card__subtitle" style={{ textAlign: "center" }}>
              Configure the Django API before signing in.
            </p>
            <p style={{ fontSize: "0.9rem", opacity: 0.9, marginTop: "1rem", lineHeight: 1.5 }}>
              Open Settings and enter your API base URL, for example{" "}
              <code>http://192.168.1.46:8000/api/v1</code>. You can also set{" "}
              <code>VITE_API_BASE_URL</code> in <code>.env</code> as a default.
            </p>
            <Link to="/settings" className="login-submit" style={{ display: "block", textAlign: "center", marginTop: "1.25rem", textDecoration: "none" }}>
              Open Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-page__bg" aria-hidden />
      <div className="login-page__shell">
        <div className="login-card">
          <div className="login-card__brand">
            <div className="login-card__logo" aria-hidden>
              <IconLogo />
            </div>
            <h1 className="login-card__title">Welcome back</h1>
            <p className="login-card__subtitle">Sign in to Chem-Solv Inventory</p>
            {!apiBase ? (
              <div className="login-error" role="status" style={{ marginTop: "0.75rem", background: "rgba(234, 179, 8, 0.12)", color: "#92400e" }}>
                Set backend URL before signing in.{" "}
                <Link to="/settings" style={{ fontWeight: 700 }}>
                  Open Settings
                </Link>
              </div>
            ) : (
              <p
                style={{
                  marginTop: "0.65rem",
                  fontSize: "0.78rem",
                  opacity: 0.7,
                  wordBreak: "break-all",
                  textAlign: "center",
                }}
              >
                {apiBase}
              </p>
            )}
          </div>

          <form onSubmit={onSubmit}>
            <div className="login-field">
              <label htmlFor="u">Username</label>
              <div className="login-input-wrap">
                <IconUser />
                <input
                  id="u"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  placeholder="Your username"
                  disabled={!hasApi}
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="p">Password</label>
              <div className="login-input-wrap">
                <IconLock />
                <input
                  id="p"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                  disabled={!hasApi}
                />
              </div>
            </div>
            {error ? (
              <div className="login-error" role="alert">
                <IconAlert />
                <span>{error}</span>
              </div>
            ) : null}
            <button type="submit" className="login-submit" disabled={busy || !hasApi}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p style={{ marginTop: "0.85rem", textAlign: "center", fontSize: "0.85rem" }}>
            <Link to="/settings" style={{ fontWeight: 600 }}>
              Connection settings
            </Link>
          </p>
        </div>
        <p className="login-page__foot">Secure workspace access · Storeman and workflow tools</p>
      </div>
    </div>
  );
}
