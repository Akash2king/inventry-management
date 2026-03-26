const { ipcMain } = require("electron");

function registerVendorsIpc(executeHttpRequest) {
  ipcMain.handle("vendors:list", async (event, { token }) => {
    return executeHttpRequest(event, {
      method: "GET",
      url: "records/vendors/",
      token,
    });
  });

  ipcMain.handle("vendors:create", async (event, { data, token }) => {
    return executeHttpRequest(event, {
      method: "POST",
      url: "records/vendors/",
      data,
      token,
    });
  });

  ipcMain.handle("vendors:update", async (event, { id, data, token }) => {
    return executeHttpRequest(event, {
      method: "PATCH",
      url: `records/vendors/${id}/`,
      data,
      token,
    });
  });
}

module.exports = { registerVendorsIpc };
