import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import {
  loadSavedApiBase,
  saveApiBase,
  suggestLanPlaceholder,
} from "@/platform/apiConfig.js";
import { initBrowserApi } from "@/platform/installBrowserApi.js";
import {
  getSystemNotificationPermission,
  isSystemNotificationSupported,
  requestSystemNotificationPermission,
} from "@/utils/systemNotifications.js";
import "./login.css";

function ActionRow({ to, label, danger, onClick }) {
  if (to) {
    return (
      <Link
        to={to}
        className={`settings-action${danger ? " settings-action--danger" : ""}`}
      >
        <span>{label}</span>
        <span aria-hidden>›</span>
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`settings-action${danger ? " settings-action--danger" : ""}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <span aria-hidden>›</span>
    </button>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const [url, setUrl] = useState(() => loadSavedApiBase());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canAudit =
    user?.role === "manager" || user?.role === "gm" || user?.role === "superadmin";
  const canGm = user?.role === "gm" || user?.role === "superadmin";

  async function handleSaveConnection() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const trimmed = saveApiBase(url);
      initBrowserApi(trimmed);
      if (!trimmed) {
        await logout().catch(() => {});
        setMessage("Connection cleared. Set a backend URL before signing in.");
        return;
      }
      await restoreSession().catch(() => {});
      setMessage("API base URL updated.");
      if (!user) {
        navigate("/login", { replace: true });
      }
    } catch (e) {
      setError(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleReRequestNotifications() {
    if (!isSystemNotificationSupported()) {
      setError("System notifications are not available in this environment.");
      return;
    }
    const p = await requestSystemNotificationPermission();
    if (p === "granted") {
      setMessage("System notifications enabled.");
    } else if (p === "denied") {
      setError("Notifications blocked — enable them in Windows / macOS settings for this app.");
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__bg" aria-hidden />
      <div className="login-page__shell" style={{ alignItems: "stretch", maxWidth: "640px" }}>
        <div className="login-card" style={{ width: "100%" }}>
          <div className="login-card__brand">
            <h1 className="login-card__title">Settings</h1>
            <p className="login-card__subtitle">Connection, account, and device tools</p>
          </div>

          <section className="settings-section">
            <div className="settings-section__head">
              <div>
                <h2 className="settings-section__title">Connection</h2>
                <p className="settings-section__hint">Point this app at your office/backend server.</p>
              </div>
              <span className="badge-completed" style={{ textTransform: "none" }}>
                LAN
              </span>
            </div>
            <p style={{ fontSize: "0.88rem", opacity: 0.85, margin: "0 0 0.5rem", lineHeight: 1.45 }}>
              If the desktop app is on the same network as Django, use your server IP address.
            </p>
            <code
              style={{
                display: "block",
                fontSize: "0.82rem",
                padding: "0.55rem 0.65rem",
                borderRadius: "8px",
                background: "rgba(15,23,42,0.04)",
                marginBottom: "0.75rem",
              }}
            >
              {suggestLanPlaceholder()}
            </code>
            <label htmlFor="api-url" className="login-field" style={{ marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>API base URL</span>
              <input
                id="api-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={`e.g. ${suggestLanPlaceholder()}`}
                autoCapitalize="off"
                autoCorrect="off"
                style={{
                  width: "100%",
                  marginTop: "0.35rem",
                  borderRadius: "10px",
                  border: "1px solid rgba(15,23,42,0.14)",
                  padding: "0.8rem 0.9rem",
                  fontSize: "0.95rem",
                }}
              />
            </label>
            <button
              type="button"
              className="login-submit"
              disabled={saving}
              onClick={() => void handleSaveConnection()}
            >
              {saving ? "Saving…" : "Save connection"}
            </button>
          </section>

          {user ? (
            <section className="settings-section" style={{ marginTop: "1.25rem" }}>
              <div className="settings-section__head">
                <div>
                  <h2 className="settings-section__title">Account</h2>
                  <p className="settings-section__hint">Signed in user and app shortcuts.</p>
                </div>
                <div className="header-user__avatar" aria-hidden style={{ width: 42, height: 42 }}>
                  {(user.full_name || user.username || "U").slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "rgba(15,23,42,0.02)",
                  marginBottom: "0.5rem",
                }}
              >
                <div style={{ fontWeight: 800 }}>{user.full_name || user.username}</div>
                <div style={{ marginTop: "0.2rem", opacity: 0.8, textTransform: "capitalize" }}>
                  {user.role || "User"}
                </div>
              </div>

              <ActionRow to="/change-password" label="Change password" />
              <ActionRow to="/sessions" label="Devices & sessions" />
              <ActionRow to="/notifications" label="Workflow notifications" />
              <ActionRow label="Re-request system notifications" onClick={() => void handleReRequestNotifications()} />
              {canAudit ? <ActionRow to="/audit-logs" label="Audit logs" /> : null}
              {canGm ? <ActionRow to="/gm" label="GM console" /> : null}
              <ActionRow
                label="Sign out"
                danger
                onClick={() => {
                  void logout().then(() => navigate("/login", { replace: true }));
                }}
              />
            </section>
          ) : (
            <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.9rem" }}>
              <Link to="/login" style={{ fontWeight: 600 }}>
                Back to sign in
              </Link>
            </p>
          )}

          {user ? (
            <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.9rem" }}>
              <Link to="/" style={{ fontWeight: 600 }}>
                Back to dashboard
              </Link>
            </p>
          ) : null}

          {message ? (
            <div
              role="status"
              style={{
                marginTop: "1rem",
                padding: "0.65rem 0.85rem",
                borderRadius: "8px",
                background: "rgba(22, 163, 74, 0.08)",
                color: "#166534",
                fontSize: "0.88rem",
              }}
            >
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="login-error" role="alert" style={{ marginTop: "1rem" }}>
              {error}
            </div>
          ) : null}

          {!user && isSystemNotificationSupported() && getSystemNotificationPermission() !== "granted" ? (
            <p style={{ marginTop: "1rem", fontSize: "0.85rem", opacity: 0.8, lineHeight: 1.45 }}>
              After signing in, enable system notifications so workflow updates appear in the tray when this window is
              in the background.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
