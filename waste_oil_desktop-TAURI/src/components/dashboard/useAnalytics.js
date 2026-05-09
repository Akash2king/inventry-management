import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore.js";

/**
 * Dashboard KPI analytics — uses the same `window.api` transport as records/workflow
 * (base URL, timeouts, JWT refresh on 401). Raw `fetch` to `VITE_API_BASE_URL` alone
 * often fails in Tauri (e.g. different host than login) and showed empty charts + errors.
 */
export function useAnalytics() {
  const token = useAuthStore((s) => s.accessToken);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!window.api?.adminConsole?.analyticsSummary) {
        if (!cancelled) {
          setError("Dashboard analytics API is not available. Check VITE_API_BASE_URL and reload.");
          setAnalytics(null);
          setLoading(false);
        }
        return;
      }
      if (!token) {
        if (!cancelled) {
          setLoading(false);
          setAnalytics(null);
          setError(null);
        }
        return;
      }

      try {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }

        const [summaryRes, stageRes, alertRes] = await Promise.all([
          window.api.adminConsole.analyticsSummary(token),
          window.api.adminConsole.analyticsRecordsByStage(token),
          window.api.adminConsole.analyticsRecordsByAlert(token),
        ]);

        if (cancelled) return;

        if (!summaryRes.ok || !stageRes.ok || !alertRes.ok) {
          const msg =
            summaryRes.error ||
            stageRes.error ||
            alertRes.error ||
            "Unable to load analytics endpoints";
          throw new Error(typeof msg === "string" ? msg : "Unable to load analytics endpoints");
        }

        setAnalytics({
          summary: summaryRes.data,
          stage: stageRes.data,
          alert: alertRes.data,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Unable to load analytics");
          setAnalytics(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { analytics, loading, error };
}
