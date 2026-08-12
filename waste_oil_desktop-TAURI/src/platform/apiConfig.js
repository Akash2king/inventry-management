/** Runtime API base URL (overrides build-time VITE_API_BASE_URL when set). */
export const STORAGE_API_BASE_KEY = "wom_desktop_api_base";

export function defaultApiBaseFromEnv() {
  const raw = import.meta.env.VITE_API_BASE_URL;
  return raw ? String(raw).trim().replace(/\/+$/, "") : "";
}

export function suggestLanPlaceholder() {
  return "http://127.0.0.1:8000/api/v1";
}

export function loadSavedApiBase() {
  try {
    const saved = localStorage.getItem(STORAGE_API_BASE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, "");
    }
  } catch {
    /* private mode / blocked storage */
  }
  return defaultApiBaseFromEnv();
}

export function saveApiBase(url) {
  const trimmed = String(url || "").trim().replace(/\/+$/, "");
  try {
    if (!trimmed) {
      localStorage.removeItem(STORAGE_API_BASE_KEY);
      return "";
    }
    localStorage.setItem(STORAGE_API_BASE_KEY, trimmed);
  } catch {
    /* ignore */
  }
  return trimmed;
}

export function resolveApiBaseUrl() {
  return loadSavedApiBase();
}
