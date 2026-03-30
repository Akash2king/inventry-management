const { app, BrowserWindow } = require("electron");
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const { registerIpcHandlers } = require("./ipc");

const isDev =
  process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow = null;

function getMainWindow() {
  return mainWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Waste Management",
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "..", "dist", "renderer", "index.html")
    );
  }
}

app.whenReady().then(() => {
  registerIpcHandlers(getMainWindow);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
