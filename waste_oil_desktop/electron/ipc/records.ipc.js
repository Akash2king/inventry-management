const { ipcMain } = require("electron");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const tokenStore = require("../utils/tokenStore");
const { getBaseURL, notifyAuthExpired, formatError } = require("./http.ipc");

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

function registerRecordsIpc(executeHttpRequest) {
  ipcMain.handle("records:getAll", async (event, { filters, token }) => {
    const qs = buildRecordsQuery(filters || {});
    return executeHttpRequest(event, {
      method: "GET",
      url: `records/${qs}`,
      token,
    });
  });

  ipcMain.handle("records:getById", async (event, { id, token }) => {
    return executeHttpRequest(event, {
      method: "GET",
      url: `records/${id}/`,
      token,
    });
  });

  ipcMain.handle("records:create", async (event, { data, token }) => {
    return executeHttpRequest(event, {
      method: "POST",
      url: "records/",
      data,
      token,
    });
  });

  ipcMain.handle("records:update", async (event, { id, data, token }) => {
    return executeHttpRequest(event, {
      method: "PATCH",
      url: `records/${id}/`,
      data,
      token,
    });
  });

  ipcMain.handle(
    "records:uploadAttachment",
    async (event, { id, filePath, token }) => {
      const baseURL = getBaseURL();
      const authToken =
        token != null && token !== ""
          ? token
          : tokenStore.getAccessToken();
      if (!authToken) {
        return { ok: false, status: 401, error: "Not authenticated" };
      }
      if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, status: 0, error: "Invalid file path" };
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(filePath));
      const url = `${baseURL}/records/${id}/attachments/`;
      const headers = {
        ...form.getHeaders(),
        Authorization: `Bearer ${authToken}`,
      };
      try {
        const res = await axios.post(url, form, {
          headers,
          validateStatus: () => true,
        });
        if (res.status === 401) {
          notifyAuthExpired(event);
          return {
            ok: false,
            status: res.status,
            error: formatError(res.data),
          };
        }
        if (res.status >= 200 && res.status < 300) {
          return { ok: true, status: res.status, data: res.data };
        }
        return {
          ok: false,
          status: res.status,
          error: formatError(res.data),
        };
      } catch (err) {
        const msg =
          err.response?.data != null
            ? formatError(err.response.data)
            : err.message || "Network error";
        return { ok: false, status: err.response?.status ?? 0, error: msg };
      }
    }
  );
}

module.exports = { registerRecordsIpc };
