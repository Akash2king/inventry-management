const {
  registerHttpIpc,
  executeHttpRequest,
  setMainWindowGetter,
} = require("./http.ipc");
const { registerAuthIpc } = require("./auth.ipc");
const { registerRecordsIpc } = require("./records.ipc");
const { registerVendorsIpc } = require("./vendors.ipc");
const { registerWorkflowIpc } = require("./workflow.ipc");
const { registerGmIpc } = require("./gm.ipc");

function registerIpcHandlers(getMainWindow) {
  setMainWindowGetter(getMainWindow);
  registerHttpIpc();
  registerAuthIpc(executeHttpRequest);
  registerRecordsIpc(executeHttpRequest);
  registerVendorsIpc(executeHttpRequest);
  registerWorkflowIpc(executeHttpRequest);
  registerGmIpc(executeHttpRequest);
}

module.exports = { registerIpcHandlers };
