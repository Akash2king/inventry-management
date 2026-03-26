const { ipcMain, BrowserWindow } = require("electron");
const axios = require("axios");
const tokenStore = require("../utils/tokenStore");

let getMainWindow = () => null;

function setMainWindowGetter(fn) {
  getMainWindow = typeof fn === "function" ? fn : () => null;
}

function getBaseURL() {
  const raw =
    process.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
  return raw.replace(/\/+$/, "");
}

function normalizeUrl(url) {
  if (!url) return "";
  return url.startsWith("/") ? url.slice(1) : url;
}

function notifyAuthExpired(event) {
  tokenStore.clearTokens();
  const win =
    getMainWindow() ||
    (event && BrowserWindow.fromWebContents(event.sender));
  win?.webContents?.send("auth:expired");
}

function formatError(data) {
  if (data == null) return "Request failed";
  if (typeof data === "string") return data;
  if (data.detail) {
    return typeof data.detail === "string"
      ? data.detail
      : JSON.stringify(data.detail);
  }
  return JSON.stringify(data);
}

async function executeHttpRequest(
  event,
  { method, url, data, token, headers, skipAuth }
) {
  const baseURL = getBaseURL();
  const path = normalizeUrl(url);
  let authToken = null;
  if (!skipAuth) {
    if (token != null && token !== "") {
      authToken = token;
    } else {
      authToken = tokenStore.getAccessToken();
    }
  }

  const hdrs = { ...(headers || {}) };
  if (authToken) {
    hdrs.Authorization = `Bearer ${authToken}`;
  }

  const config = {
    method: (method || "GET").toLowerCase(),
    baseURL,
    url: path,
    headers: hdrs,
    validateStatus: () => true,
    timeout: 120000,
  };

  if (data !== undefined && config.method !== "get") {
    config.data = data;
  }

  try {
    const res = await axios(config);
    if (res.status === 401) {
      if (!skipAuth && authToken) {
        notifyAuthExpired(event);
      }
      return {
        ok: false,
        status: res.status,
        error: formatError(res.data),
        data: res.data,
      };
    }
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status, data: res.data };
    }
    return {
      ok: false,
      status: res.status,
      error: formatError(res.data),
      data: res.data,
    };
  } catch (err) {
    const msg =
      err.response?.data != null
        ? formatError(err.response.data)
        : err.message || "Network error";
    return { ok: false, status: err.response?.status ?? 0, error: msg };
  }
}

function registerHttpIpc() {
  ipcMain.handle("http:request", (event, payload) =>
    executeHttpRequest(event, payload)
  );
}

module.exports = {
  registerHttpIpc,
  executeHttpRequest,
  setMainWindowGetter,
  getBaseURL,
  notifyAuthExpired,
  formatError,
};
