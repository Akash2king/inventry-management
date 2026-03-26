const { ipcMain } = require("electron");
const tokenStore = require("../utils/tokenStore");

function registerAuthIpc(executeHttpRequest) {
  ipcMain.handle("auth:login", async (_event, body) => {
    const res = await executeHttpRequest(null, {
      method: "POST",
      url: "auth/login/",
      data: body,
      skipAuth: true,
    });
    if (res.ok && res.data?.access_token) {
      tokenStore.setAccessToken(res.data.access_token);
      if (res.data.refresh_token) {
        tokenStore.setRefreshToken(res.data.refresh_token);
      }
    }
    return res;
  });

  ipcMain.handle("auth:logout", async (_event, body) => {
    const refresh =
      body?.refresh_token || tokenStore.getRefreshToken() || "";
    await executeHttpRequest(null, {
      method: "POST",
      url: "auth/logout/",
      data: { refresh_token: refresh },
      skipAuth: true,
    });
    tokenStore.clearTokens();
    return { ok: true, status: 200, data: { detail: "Logged out." } };
  });

  ipcMain.handle("auth:me", async (event, { token } = {}) => {
    const t =
      token !== undefined && token !== null && token !== ""
        ? token
        : tokenStore.getAccessToken();
    if (!t) {
      return { ok: false, status: 401, error: "Not authenticated" };
    }
    return executeHttpRequest(event, {
      method: "GET",
      url: "auth/me/",
      data: undefined,
      token: t,
    });
  });
}

module.exports = { registerAuthIpc };
