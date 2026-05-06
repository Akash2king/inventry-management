import AsyncStorage from "@react-native-async-storage/async-storage";
import { humanizeApiErrorBody } from "../src/utils/apiErrors.js";

const LS_ACCESS = "wom_access_token";
const LS_REFRESH = "wom_refresh_token";
const LS_USER = "wom_user_profile";

const API_TIMEOUT_MS = 12000;

async function fetchWithTimeout(url, init, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildRecordsQuery(filters = {}) {
  const p = new URLSearchParams();
  if (filters.page) p.set("page", String(filters.page));
  if (filters.page_size) p.set("page_size", String(filters.page_size));
  if (filters.stage != null && filters.stage !== "") {
    p.set("stage", String(filters.stage));
  }
  if (filters.date_from) p.set("date_from", filters.date_from);
  if (filters.date_to) p.set("date_to", filters.date_to);
  if (filters.search) p.set("search", filters.search);
  if (filters.alert_level) p.set("alert_level", String(filters.alert_level));
  if (filters.department_id != null && filters.department_id !== "") {
    p.set("department_id", String(filters.department_id));
  }
  if (filters.exclude_completed) p.set("exclude_completed", "1");
  if (filters.overdue) p.set("overdue", "1");
  const q = p.toString();
  return q ? `?${q}` : "";
}

function formatError(data) {
  return humanizeApiErrorBody(data);
}

/**
 * Fetch-based API for React Native — same endpoints as src/platform/installBrowserApi.js
 * but AsyncStorage tokens and fully async requests.
 */
export function createNativeApi(rawBaseUrl) {
  const base = String(rawBaseUrl || "").replace(/\/+$/, "");
  if (!base) {
    throw new Error("API base URL is empty");
  }

  async function getAccessToken() {
    const t = await AsyncStorage.getItem(LS_ACCESS);
    return t || "";
  }

  async function persistLogin(data) {
    if (data?.access_token) {
      await AsyncStorage.setItem(LS_ACCESS, data.access_token);
    }
    if (data?.refresh_token) {
      await AsyncStorage.setItem(LS_REFRESH, data.refresh_token);
    }
    if (data?.user) {
      await AsyncStorage.setItem(LS_USER, JSON.stringify(data.user));
    }
  }

  async function clearTokens() {
    await AsyncStorage.multiRemove([LS_ACCESS, LS_REFRESH, LS_USER]);
  }

  async function request(method, path, options = {}) {
    const { body, json, token, skipAuth, headers: extra = {} } = options;
    const url = `${base}/${path.replace(/^\//, "")}`;
    const headers = { ...extra };

    let authToken = null;
    if (!skipAuth) {
      authToken =
        token !== undefined && token !== null && token !== ""
          ? token
          : await getAccessToken();
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
    }

    const init = { method, headers };
    if (json !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(json);
    } else if (body !== undefined) {
      init.body = body;
    }

    let res;
    try {
      res = await fetchWithTimeout(url, init);
    } catch (e) {
      const isTimeout = e?.name === "AbortError";
      return {
        ok: false,
        status: 0,
        error: isTimeout ? "Request timeout. Check API URL and Wi‑Fi." : e.message || "Network error",
      };
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (
      res.status === 403 &&
      data &&
      typeof data === "object" &&
      data.code === "password_change_required"
    ) {
      /* consumer can inspect data */
    }

    if (res.status === 401) {
      if (!skipAuth && authToken) {
        await clearTokens();
      }
      return {
        ok: false,
        status: res.status,
        error: formatError(data),
        data,
      };
    }

    if (res.ok) {
      return { ok: true, status: res.status, data };
    }
    return {
      ok: false,
      status: res.status,
      error: formatError(data),
      data,
    };
  }

  return {
    async readCachedUser() {
      try {
        const raw = await AsyncStorage.getItem(LS_USER);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch {
        return null;
      }
    },
    persistCachedUser(user) {
      if (!user) {
        return AsyncStorage.removeItem(LS_USER);
      }
      return AsyncStorage.setItem(LS_USER, JSON.stringify(user));
    },
    auth: {
      login: async (data) => {
        const res = await request("POST", "auth/login/", {
          json: data,
          skipAuth: true,
        });
        if (res.ok && res.data?.access_token) {
          await persistLogin(res.data);
        }
        return res;
      },
      logout: async () => {
        const refresh = (await AsyncStorage.getItem(LS_REFRESH)) || "";
        await request("POST", "auth/logout/", {
          json: { refresh_token: refresh },
          skipAuth: true,
        });
        await clearTokens();
        return { ok: true, status: 200, data: { detail: "Logged out." } };
      },
      me: async (tokenArg) => {
        const t =
          tokenArg !== undefined && tokenArg !== null && tokenArg !== ""
            ? tokenArg
            : await getAccessToken();
        if (!t) {
          return { ok: false, status: 401, error: "Not authenticated" };
        }
        return request("GET", "auth/me/", { token: t });
      },
    },
    records: {
      getAll: async (filters, tokenArg) => {
        const qs = buildRecordsQuery(filters || {});
        return request("GET", `records/${qs}`, { token: tokenArg });
      },
      getById: async (id, tokenArg) =>
        request("GET", `records/${id}/`, { token: tokenArg }),
    },
    workflow: {
      forward: async (id, payload, tokenArg) => {
        const body =
          typeof payload === "string"
            ? { note: payload ?? "" }
            : {
                note: payload?.note ?? "",
                ...(payload?.next_holder_id
                  ? { next_holder_id: payload.next_holder_id }
                  : {}),
              };
        return request("POST", `records/${id}/forward/`, {
          json: body,
          token: tokenArg,
        });
      },
      returnRecord: async (id, reason, tokenArg) =>
        request("POST", `records/${id}/return/`, {
          json: { reason },
          token: tokenArg,
        }),
      getQueue: async (tokenArg) =>
        request("GET", "workflow/queue/", { token: tokenArg }),
      getTransitions: async (id, tokenArg) =>
        request("GET", `records/${id}/transitions/`, { token: tokenArg }),
    },
  };
}
