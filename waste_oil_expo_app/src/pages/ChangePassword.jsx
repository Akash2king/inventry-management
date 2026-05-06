import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { humanizeApiErrorBody } from "@/utils/apiErrors.js";
import "./login.css";

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
        fill="url(#cpLogoGrad)"
      />
      <defs>
        <linearGradient id="cpLogoGrad" x1="7" y1="2" x2="17" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3578e5" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ChangePassword() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  function parseError(err) {
    let msg = String(err?.message || "");
    if (msg.startsWith("{")) {
      try {
        msg = humanizeApiErrorBody(JSON.parse(msg));
      } catch {
        /* keep */
      }
    }
    return msg.trim() || "Something went wrong";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!current) {
      setError("Enter your current password.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      navigate("/", { replace: true });
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await logout().catch(() => {});
    navigate("/login", { replace: true });
  }

  const mustChange = Boolean(user?.must_change_password);
  const showForm = isAuthenticated && !!user;

  if (!showForm) {
    return (
      <div className="login-page">
        <div className="login-page__bg" aria-hidden />
        <div className="login-page__shell" style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
          <div className="spinner" />
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
            <h1 className="login-card__title">
              {mustChange ? "Set a new password" : "Change password"}
            </h1>
            <p className="login-card__subtitle">
              {mustChange ? (
                <>
                  For security, you must change your password before using the rest of the app. Signed in as{" "}
                  <strong>{user.username}</strong>.
                </>
              ) : (
                <>
                  Update your password anytime. Signed in as <strong>{user.username}</strong>.
                </>
              )}
            </p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="login-field">
              <label htmlFor="cp-old">Current password</label>
              <div className="login-input-wrap">
                <IconLock />
                <input
                  id="cp-old"
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder={mustChange ? "From your welcome email" : "Current password"}
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="cp-new">New password</label>
              <div className="login-input-wrap">
                <IconLock />
                <input
                  id="cp-new"
                  name="new"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="cp-confirm">Confirm new password</label>
              <div className="login-input-wrap">
                <IconLock />
                <input
                  id="cp-confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                />
              </div>
            </div>
            {error ? (
              <div className="login-error" role="alert">
                <span>{error}</span>
              </div>
            ) : null}
            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
            {!mustChange ? (
              <button
                type="button"
                className="login-submit"
                style={{
                  marginTop: "0.65rem",
                  background: "transparent",
                  color: "var(--clr-text-muted, #64748b)",
                  border: "1px solid rgba(100, 116, 139, 0.35)",
                  boxShadow: "none",
                }}
                onClick={() => navigate("/", { replace: true })}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className="login-submit"
              style={{
                marginTop: "0.65rem",
                background: "transparent",
                color: "var(--clr-text-muted, #64748b)",
                border: "1px solid rgba(100, 116, 139, 0.35)",
                boxShadow: "none",
              }}
              onClick={onLogout}
            >
              Sign out
            </button>
          </form>
        </div>
        <p className="login-page__foot">
          {mustChange ? "Required step for new accounts" : "Use a strong password you do not reuse elsewhere."}
        </p>
      </div>
    </div>
  );
}
