/**
 * This UI talks to `window.api`. In Tauri we keep the frontend browser-like, so
 * we install a fetch-based shim whenever a native bridge is not present.
 */
import { humanizeApiErrorBody } from "@/utils/apiErrors.js";

const LS_ACCESS = "wom_access_token";
const LS_REFRESH = "wom_refresh_token";
const LS_SESSION = "wom_session_id";
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

function createBrowserApi(baseUrl) {
  const base = baseUrl.replace(/\/+$/, "");

  async function tryRefreshAccess() {
    const refresh = localStorage.getItem(LS_REFRESH);
    if (!refresh) {
      return false;
    }
    const url = `${base}/auth/refresh/`;
    let res;
    try {
      res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch {
      return false;
    }
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok || !data?.access_token) {
      return false;
    }
    localStorage.setItem(LS_ACCESS, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(LS_REFRESH, data.refresh_token);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wom:tokens-refreshed"));
    }
    return true;
  }

  async function request(method, path, options = {}) {
    const {
      body,
      json,
      token,
      skipAuth,
      headers: extra = {},
      _didRefresh,
    } = options;
    const url = `${base}/${path.replace(/^\//, "")}`;
    const headers = { ...extra };

    let authToken = null;
    if (!skipAuth) {
      authToken =
        token !== undefined && token !== null && token !== ""
          ? token
          : localStorage.getItem(LS_ACCESS);
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const sid = localStorage.getItem(LS_SESSION);
      if (sid) {
        headers["X-Session-Id"] = sid;
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
        error: isTimeout ? "Request timeout. Please check backend connectivity." : e.message || "Network error",
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
      window.dispatchEvent(new CustomEvent("wom:password-change-required"));
    }

    if (res.status === 401) {
      const p = path.replace(/^\//, "");
      const canTryRefresh =
        !skipAuth &&
        authToken &&
        !_didRefresh &&
        !p.startsWith("auth/login") &&
        !p.startsWith("auth/refresh") &&
        !p.startsWith("auth/logout");
      if (canTryRefresh) {
        const refreshed = await tryRefreshAccess();
        if (refreshed) {
          // Drop caller-supplied token so the retry uses the new access_token from localStorage.
          const retryOpts = { ...options, _didRefresh: true };
          delete retryOpts.token;
          return request(method, path, retryOpts);
        }
      }
      if (!skipAuth && authToken) {
        localStorage.removeItem(LS_ACCESS);
        localStorage.removeItem(LS_REFRESH);
        localStorage.removeItem(LS_SESSION);
        window.dispatchEvent(new CustomEvent("wom:auth-expired"));
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

  /** GET binary PDF (or other non-JSON) with JWT; returns Uint8Array + filename from Content-Disposition. */
  async function requestPdfGet(path, tokenArg) {
    const url = `${base}/${path.replace(/^\//, "")}`;
    const headers = {};
    const authToken =
      tokenArg !== undefined && tokenArg !== null && tokenArg !== ""
        ? tokenArg
        : localStorage.getItem(LS_ACCESS);
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const sidPdf = localStorage.getItem(LS_SESSION);
    if (sidPdf) {
      headers["X-Session-Id"] = sidPdf;
    }
    let res;
    try {
      res = await fetchWithTimeout(url, { method: "GET", headers });
    } catch (e) {
      const isTimeout = e?.name === "AbortError";
      return {
        ok: false,
        status: 0,
        error: isTimeout ? "Request timeout. Please check backend connectivity." : e.message || "Network error",
      };
    }
    if (res.status === 401) {
      if (authToken) {
        localStorage.removeItem(LS_ACCESS);
        localStorage.removeItem(LS_REFRESH);
        localStorage.removeItem(LS_SESSION);
        window.dispatchEvent(new CustomEvent("wom:auth-expired"));
      }
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return {
        ok: false,
        status: res.status,
        error: formatError(data),
        data,
      };
    }
    if (!res.ok) {
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return {
        ok: false,
        status: res.status,
        error: formatError(data),
        data,
      };
    }
    const buf = await res.arrayBuffer();
    const cd = res.headers.get("Content-Disposition") || "";
    let filename = "monthly_inventory.pdf";
    const m = cd.match(/filename="([^"]+)"/) || cd.match(/filename=([^;\s]+)/);
    if (m) {
      filename = (m[1] || m[2] || filename).trim();
    }
    return {
      ok: true,
      status: res.status,
      data: new Uint8Array(buf),
      filename,
    };
  }

  /** GET image or other binary body with JWT; returns Blob. */
  async function requestBlobGet(path, tokenArg) {
    const url = `${base}/${path.replace(/^\//, "")}`;
    const headers = {};
    const authToken =
      tokenArg !== undefined && tokenArg !== null && tokenArg !== ""
        ? tokenArg
        : localStorage.getItem(LS_ACCESS);
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const sid = localStorage.getItem(LS_SESSION);
    if (sid) {
      headers["X-Session-Id"] = sid;
    }
    let res;
    try {
      res = await fetchWithTimeout(url, { method: "GET", headers });
    } catch (e) {
      const isTimeout = e?.name === "AbortError";
      return {
        ok: false,
        status: 0,
        error: isTimeout ? "Request timeout. Please check backend connectivity." : e.message || "Network error",
      };
    }
    if (res.status === 401) {
      if (authToken) {
        localStorage.removeItem(LS_ACCESS);
        localStorage.removeItem(LS_REFRESH);
        localStorage.removeItem(LS_SESSION);
        window.dispatchEvent(new CustomEvent("wom:auth-expired"));
      }
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return {
        ok: false,
        status: res.status,
        error: formatError(data),
        data,
      };
    }
    if (!res.ok) {
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return {
        ok: false,
        status: res.status,
        error: formatError(data),
        data,
      };
    }
    const blob = await res.blob();
    return {
      ok: true,
      status: res.status,
      blob,
      contentType: res.headers.get("Content-Type") || "",
    };
  }

  return {
    auth: {
      login: async (data) => {
        const res = await request("POST", "auth/login/", {
          json: data,
          skipAuth: true,
        });
        if (res.ok && res.data?.access_token) {
          localStorage.setItem(LS_ACCESS, res.data.access_token);
          if (res.data.refresh_token) {
            localStorage.setItem(LS_REFRESH, res.data.refresh_token);
          }
          if (res.data.session?.id) {
            localStorage.setItem(LS_SESSION, String(res.data.session.id));
          } else {
            localStorage.removeItem(LS_SESSION);
          }
        }
        return res;
      },
      logout: async (data) => {
        const refresh =
          data?.refresh_token || localStorage.getItem(LS_REFRESH) || "";
        await request("POST", "auth/logout/", {
          json: { refresh_token: refresh },
          skipAuth: true,
        });
        localStorage.removeItem(LS_ACCESS);
        localStorage.removeItem(LS_REFRESH);
        localStorage.removeItem(LS_SESSION);
        return { ok: true, status: 200, data: { detail: "Logged out." } };
      },
      listSessions: async (params = {}, tokenArg) => {
        const p = new URLSearchParams();
        if (params.active === false) {
          p.set("active", "0");
        } else {
          p.set("active", "1");
        }
        return request("GET", `auth/sessions/?${p.toString()}`, { token: tokenArg });
      },
      revokeSession: async (id, tokenArg) =>
        request("DELETE", `auth/sessions/${id}/`, { token: tokenArg }),
      me: async (tokenArg) => {
        const t =
          tokenArg !== undefined && tokenArg !== null && tokenArg !== ""
            ? tokenArg
            : localStorage.getItem(LS_ACCESS);
        if (!t) {
          return { ok: false, status: 401, error: "Not authenticated" };
        }
        return request("GET", "auth/me/", { token: t });
      },
      changePassword: async (payload) =>
        request("POST", "auth/change-password/", {
          json: {
            old_password: payload.old_password,
            new_password: payload.new_password,
          },
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
        request("PATCH", `records/vendors/${id}/`, {
          json: data,
          token: tokenArg,
        }),
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
      uploadAttachment: async (id, file) => {
        if (!file) {
          return { ok: false, status: 0, error: "No file" };
        }
        const form = new FormData();
        form.append("file", file);
        return request("POST", `records/${id}/attachments/`, { body: form });
      },
      uploadPhoto: async (id, file, tokenArg) => {
        if (!file) {
          return { ok: false, status: 0, error: "No file" };
        }
        const form = new FormData();
        form.append("file", file);
        return request("POST", `records/${id}/photo/`, { body: form, token: tokenArg });
      },
      getEntryPhoto: async (id, tokenArg) =>
        requestBlobGet(`records/${id}/photo/`, tokenArg),
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
        request("GET", `records/${id}/forward-candidates/`, {
          token: tokenArg,
        }),
    },
    gm: {
      getDepartments: async (tokenArg) =>
        request("GET", "gm/departments/", { token: tokenArg }),
      createDepartment: async (data, tokenArg) =>
        request("POST", "gm/departments/", { json: data, token: tokenArg }),
      updateDepartment: async (id, data, tokenArg) =>
        request("PATCH", `gm/departments/${id}/`, { json: data, token: tokenArg }),
      deleteDepartment: async (id, tokenArg) =>
        request("DELETE", `gm/departments/${id}/`, { token: tokenArg }),
      getEmployees: async (filters) => {
        const p = new URLSearchParams();
        if (filters?.department_id) p.set("department_id", filters.department_id);
        if (filters?.role) p.set("role", filters.role);
        if (filters?.search) p.set("search", filters.search);
        const q = p.toString();
        const path = q ? `gm/employees/?${q}` : "gm/employees/";
        return request("GET", path);
      },
      createEmployee: async (data) =>
        request("POST", "gm/employees/", { json: data }),
      updateEmployee: async (id, data) =>
        request("PATCH", `gm/employees/${id}/`, { json: data }),
      deleteEmployee: async (id) =>
        request("DELETE", `gm/employees/${id}/`),
      getMonthlyReport: async (params = {}) => {
        const p = new URLSearchParams();
        if (params.from) p.set("from", params.from);
        if (params.to) p.set("to", params.to);
        const q = p.toString();
        const path = q
          ? `admin-console/reports/gm/monthly/?${q}`
          : "admin-console/reports/gm/monthly/";
        return request("GET", path);
      },
      getMonthlyReportPdf: async (params = {}, tokenArg) => {
        const p = new URLSearchParams();
        if (params.from) p.set("from", params.from);
        if (params.to) p.set("to", params.to);
        const q = p.toString();
        const path = q
          ? `admin-console/reports/gm/monthly/pdf/?${q}`
          : "admin-console/reports/gm/monthly/pdf/";
        return requestPdfGet(path, tokenArg);
      },
    },
    audit: {
      getLogs: async (queryString = "", tokenArg) =>
        request("GET", `audit/logs/${queryString || ""}`, { token: tokenArg }),
    },
    adminConsole: {
      analyticsSummary: (tokenArg) =>
        request("GET", "admin-console/analytics/summary/", { token: tokenArg }),
      analyticsRecordsByStage: (tokenArg) =>
        request("GET", "admin-console/analytics/records/by-stage/", { token: tokenArg }),
      analyticsRecordsByAlert: (tokenArg) =>
        request("GET", "admin-console/analytics/records/by-alert/", { token: tokenArg }),
    },
    notifications: {
      list: async (params = {}, tokenArg) => {
        const p = new URLSearchParams();
        if (params.unread) {
          p.set("unread", "1");
        }
        if (params.page != null && params.page !== "") {
          p.set("page", String(params.page));
        }
        if (params.page_size != null && params.page_size !== "") {
          p.set("page_size", String(params.page_size));
        }
        const q = p.toString();
        return request("GET", q ? `notifications/?${q}` : "notifications/", {
          token: tokenArg,
        });
      },
      unreadCount: async (tokenArg) =>
        request("GET", "notifications/unread-count/", { token: tokenArg }),
      broadcast: async (data, tokenArg) =>
        request("POST", "notifications/broadcast/", { json: data, token: tokenArg }),
      markRead: async (id, tokenArg) =>
        request("POST", `notifications/${id}/read/`, { token: tokenArg }),
      markAllRead: async (tokenArg) =>
        request("POST", "notifications/mark-all-read/", { token: tokenArg }),
    },
    onAuthExpired: (callback) => {
      const fn = () => callback();
      window.addEventListener("wom:auth-expired", fn);
      return () => window.removeEventListener("wom:auth-expired", fn);
    },
  };
}

if (typeof window !== "undefined" && !window.api) {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (raw) {
    window.api = createBrowserApi(String(raw));
  }
}
