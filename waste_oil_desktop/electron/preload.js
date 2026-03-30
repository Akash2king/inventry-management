const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("api", {
  auth: {
    login: (data) => ipcRenderer.invoke("auth:login", data),
    logout: (data) => ipcRenderer.invoke("auth:logout", data),
    me: (token) => ipcRenderer.invoke("auth:me", { token }),
  },
  vendors: {
    list: (token) => ipcRenderer.invoke("vendors:list", { token }),
    get: (id, token) => ipcRenderer.invoke("vendors:get", { id, token }),
    create: (data, token) =>
      ipcRenderer.invoke("vendors:create", { data, token }),
    update: (id, data, token) =>
      ipcRenderer.invoke("vendors:update", { id, data, token }),
    remove: (id, token) => ipcRenderer.invoke("vendors:remove", { id, token }),
  },
  records: {
    getAll: (filters, token) =>
      ipcRenderer.invoke("records:getAll", { filters, token }),
    getById: (id, token) =>
      ipcRenderer.invoke("records:getById", { id, token }),
    create: (data, token) =>
      ipcRenderer.invoke("records:create", { data, token }),
    update: (id, data, token) =>
      ipcRenderer.invoke("records:update", { id, data, token }),
    uploadAttachment: (id, file, token) => {
      let filePath = null;
      if (file && typeof file === "object" && "path" in file && file.path) {
        filePath = file.path;
      } else if (file && typeof webUtils?.getPathForFile === "function") {
        try {
          filePath = webUtils.getPathForFile(file);
        } catch {
          filePath = null;
        }
      }
      return ipcRenderer.invoke("records:uploadAttachment", {
        id,
        filePath,
        token,
      });
    },
  },
  workflow: {
    forward: (id, payload, token) => {
      const data =
        typeof payload === "string"
          ? { note: payload ?? "" }
          : {
              note: payload?.note ?? "",
              ...(payload?.next_holder_id
                ? { next_holder_id: payload.next_holder_id }
                : {}),
            };
      return ipcRenderer.invoke("workflow:forward", { id, data, token });
    },
    returnRecord: (id, reason, token) =>
      ipcRenderer.invoke("workflow:return", { id, reason, token }),
    getQueue: (token) => ipcRenderer.invoke("workflow:queue", { token }),
    getTransitions: (id, token) =>
      ipcRenderer.invoke("workflow:transitions", { id, token }),
    getForwardCandidates: (id, token) =>
      ipcRenderer.invoke("workflow:forwardCandidates", { id, token }),
  },
  gm: {
    getDepartments: (token) =>
      ipcRenderer.invoke("gm:getDepartments", { token }),
    getEmployees: (filters, token) =>
      ipcRenderer.invoke("gm:getEmployees", { filters, token }),
    createEmployee: (data, token) =>
      ipcRenderer.invoke("gm:createEmployee", { data, token }),
    updateEmployee: (id, data, token) =>
      ipcRenderer.invoke("gm:updateEmployee", { id, data, token }),
  },
  onAuthExpired: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("auth:expired", handler);
    return () => ipcRenderer.removeListener("auth:expired", handler);
  },
});
