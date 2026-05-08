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

function buildQuery(filters = {}) {
  const p = new URLSearchParams();
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    p.set(k, String(v));
  });
  const q = p.toString();
  return q ? `?${q}` : "";
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

  async function requestBinary(method, path, options = {}) {
    const { token, skipAuth, headers: extra = {} } = options;
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

    let res;
    try {
      res = await fetchWithTimeout(url, { method, headers });
    } catch (e) {
      const isTimeout = e?.name === "AbortError";
      return {
        ok: false,
        status: 0,
        error: isTimeout ? "Request timeout. Check API URL and Wi‑Fi." : e.message || "Network error",
      };
    }

    if (res.status === 401) {
      if (!skipAuth && authToken) {
        await clearTokens();
      }
      return { ok: false, status: res.status, error: "Unauthorized" };
    }

    if (!res.ok) {
      // best-effort parse error body
      try {
        const text = await res.text();
        let data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        return { ok: false, status: res.status, error: formatError(data), data };
      } catch {
        return { ok: false, status: res.status, error: `Request failed (${res.status})` };
      }
    }

    const ab = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "";
    return { ok: true, status: res.status, data: new Uint8Array(ab), contentType };
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
      changePassword: async (payload, tokenArg) =>
        request("POST", "auth/change-password/", {
          json: {
            old_password: payload?.old_password,
            new_password: payload?.new_password,
          },
          token: tokenArg,
        }),
    },
    vendors: {
      list: async (tokenArg) =>
        request("GET", "records/vendors/", { token: tokenArg }),
      get: async (id, tokenArg) =>
        request("GET", `records/vendors/${id}/`, { token: tokenArg }),
      create: async (data, tokenArg) =>
        request("POST", "records/vendors/", { json: data, token: tokenArg }),
      update: async (id, data, tokenArg) =>
        request("PATCH", `records/vendors/${id}/`, { json: data, token: tokenArg }),
      remove: async (id, tokenArg) =>
        request("DELETE", `records/vendors/${id}/`, { token: tokenArg }),
    },
    records: {
      getAll: async (filters, tokenArg) => {
        const qs = buildRecordsQuery(filters || {});
        return request("GET", `records/${qs}`, { token: tokenArg });
      },
      getById: async (id, tokenArg) =>
        request("GET", `records/${id}/`, { token: tokenArg }),
      create: async (data, tokenArg) =>
        request("POST", "records/", { json: data, token: tokenArg }),
      update: async (id, data, tokenArg) =>
        request("PATCH", `records/${id}/`, { json: data, token: tokenArg }),
      uploadPhoto: async (id, asset, tokenArg) => {
        if (!asset?.uri) {
          return { ok: false, status: 0, error: "No photo selected" };
        }
        const form = new FormData();
        const name = asset.fileName || `photo_${String(id)}.jpg`;
        const type = asset.mimeType || "image/jpeg";
        form.append("file", { uri: asset.uri, name, type });
        return request("POST", `records/${id}/photo/`, { body: form, token: tokenArg });
      },
      getEntryPhoto: async (id, tokenArg) =>
        requestBinary("GET", `records/${id}/photo/`, { token: tokenArg }),
      listOptions: async (filters, tokenArg) => {
        const p = new URLSearchParams();
        if (filters?.category) p.set("category", filters.category);
        const q = p.toString();
        const path = q ? `records/options/?${q}` : "records/options/";
        return request("GET", path, { token: tokenArg });
      },
      createOption: async (data, tokenArg) =>
        request("POST", "records/options/", { json: data, token: tokenArg }),
      deleteOption: async (id, tokenArg) =>
        request("DELETE", `records/options/${id}/`, { token: tokenArg }),
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
      getForwardCandidates: async (id, tokenArg) =>
        request("GET", `records/${id}/forward-candidates/`, { token: tokenArg }),
    },
    audit: {
      getLogs: async (filters, tokenArg) => {
        const qs = buildQuery(filters || {});
        return request("GET", `audit/logs/${qs}`, { token: tokenArg });
      },
    },
    gm: {
      getDepartments: async (tokenArg) => request("GET", "gm/departments/", { token: tokenArg }),
      createDepartment: async (data, tokenArg) =>
        request("POST", "gm/departments/", { json: data, token: tokenArg }),
      updateDepartment: async (id, data, tokenArg) =>
        request("PATCH", `gm/departments/${id}/`, { json: data, token: tokenArg }),
      deleteDepartment: async (id, tokenArg) =>
        request("DELETE", `gm/departments/${id}/`, { token: tokenArg }),

      getEmployees: async (filters, tokenArg) => {
        const qs = buildQuery(filters || {});
        return request("GET", `gm/employees/${qs}`, { token: tokenArg });
      },
      createEmployee: async (data, tokenArg) =>
        request("POST", "gm/employees/", { json: data, token: tokenArg }),
      updateEmployee: async (id, data, tokenArg) =>
        request("PATCH", `gm/employees/${id}/`, { json: data, token: tokenArg }),
      deleteEmployee: async (id, tokenArg) =>
        request("DELETE", `gm/employees/${id}/`, { token: tokenArg }),

      getMonthlyReport: async (params, tokenArg) => {
        const qs = buildQuery({ from: params?.from, to: params?.to });
        const path = qs
          ? `admin-console/reports/gm/monthly/${qs}`
          : "admin-console/reports/gm/monthly/";
        return request("GET", path, { token: tokenArg });
      },
      getMonthlyReportPdf: async (params, tokenArg) => {
        const qs = buildQuery({ from: params?.from, to: params?.to });
        const path = qs
          ? `admin-console/reports/gm/monthly/pdf/${qs}`
          : "admin-console/reports/gm/monthly/pdf/";
        return requestBinary("GET", path, { token: tokenArg });
      },
    },
  };
}
