/**
 * This UI talks to `window.api`. In Tauri we keep the frontend browser-like, so
 * we install a fetch-based shim whenever a native bridge is not present.
 */
const LS_ACCESS = "wom_access_token";
const LS_REFRESH = "wom_refresh_token";

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
  if (data == null) return "Request failed";
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (data.detail) return JSON.stringify(data.detail);
  return JSON.stringify(data);
}

function createBrowserApi(baseUrl) {
  const base = baseUrl.replace(/\/+$/, "");

  async function request(method, path, options = {}) {
    const {
      body,
      json,
      token,
      skipAuth,
      headers: extra = {},
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
      res = await fetch(url, init);
    } catch (e) {
      return { ok: false, status: 0, error: e.message || "Network error" };
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

    if (res.status === 401) {
      if (!skipAuth && authToken) {
        localStorage.removeItem(LS_ACCESS);
        localStorage.removeItem(LS_REFRESH);
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
        return { ok: true, status: 200, data: { detail: "Logged out." } };
      },
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
      getDepartments: async () => request("GET", "gm/departments/"),
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
