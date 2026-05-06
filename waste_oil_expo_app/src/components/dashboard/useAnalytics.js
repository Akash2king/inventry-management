import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export function useAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all analytics data in parallel
        const [summaryRes, stageRes, alertRes] = await Promise.all([
          fetch(`${API_BASE}/admin-console/analytics/summary/`),
          fetch(`${API_BASE}/admin-console/analytics/records/by-stage/`),
          fetch(`${API_BASE}/admin-console/analytics/records/by-alert/`),
        ]);

        if (!summaryRes.ok || !stageRes.ok || !alertRes.ok) {
          throw new Error("Unable to load analytics endpoints");
        }

        const summary = await summaryRes.json();
        const stage = await stageRes.json();
        const alert = await alertRes.json();

        setAnalytics({ summary, stage, alert });
      } catch (err) {
        setError(err.message);
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return { analytics, loading, error };
}
