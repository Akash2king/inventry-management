const { ipcMain } = require("electron");

function registerWorkflowIpc(executeHttpRequest) {
  ipcMain.handle("workflow:forward", async (event, { id, data, token }) => {
    const body =
      typeof data === "string"
        ? { note: data ?? "" }
        : {
            note: data?.note ?? "",
            ...(data?.next_holder_id
              ? { next_holder_id: data.next_holder_id }
              : {}),
          };
    return executeHttpRequest(event, {
      method: "POST",
      url: `records/${id}/forward/`,
      data: body,
      token,
    });
  });

  ipcMain.handle("workflow:forwardCandidates", async (event, { id, token }) => {
    return executeHttpRequest(event, {
      method: "GET",
      url: `records/${id}/forward-candidates/`,
      token,
    });
  });

  ipcMain.handle("workflow:return", async (event, { id, reason, token }) => {
    return executeHttpRequest(event, {
      method: "POST",
      url: `records/${id}/return/`,
      data: { reason },
      token,
    });
  });

  ipcMain.handle("workflow:queue", async (event, { token }) => {
    return executeHttpRequest(event, {
      method: "GET",
      url: "workflow/queue/",
      token,
    });
  });

  ipcMain.handle("workflow:transitions", async (event, { id, token }) => {
    return executeHttpRequest(event, {
      method: "GET",
      url: `records/${id}/transitions/`,
      token,
    });
  });
}

module.exports = { registerWorkflowIpc };
