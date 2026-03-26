const { ipcMain } = require("electron");

function buildEmployeeQuery(filters = {}) {
  const p = new URLSearchParams();
  if (filters.department_id) p.set("department_id", filters.department_id);
  if (filters.role) p.set("role", filters.role);
  if (filters.search) p.set("search", filters.search);
  const q = p.toString();
  return q ? `?${q}` : "";
}

function registerGmIpc(executeHttpRequest) {
  ipcMain.handle("gm:getDepartments", async (event, { token }) => {
    return executeHttpRequest(event, {
      method: "GET",
      url: "gm/departments/",
      token,
    });
  });

  ipcMain.handle("gm:getEmployees", async (event, { filters, token }) => {
    const qs = buildEmployeeQuery(filters || {});
    return executeHttpRequest(event, {
      method: "GET",
      url: `gm/employees/${qs}`,
      token,
    });
  });

  ipcMain.handle("gm:createEmployee", async (event, { data, token }) => {
    return executeHttpRequest(event, {
      method: "POST",
      url: "gm/employees/",
      data,
      token,
    });
  });

  ipcMain.handle("gm:updateEmployee", async (event, { id, data, token }) => {
    return executeHttpRequest(event, {
      method: "PATCH",
      url: `gm/employees/${id}/`,
      data,
      token,
    });
  });
}

module.exports = { registerGmIpc };
