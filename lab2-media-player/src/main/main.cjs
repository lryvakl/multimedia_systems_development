"use strict";

const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { buildMenu } = require("./menu.cjs");
const { registerIpcHandlers } = require("./ipc.cjs");
const { relaxCorsForMedia } = require("./cors.cjs");
const { collectMediaArgs, toMediaDescriptor } = require("./media-files.cjs");

const isDev = process.argv.includes("--dev");

/** @type {BrowserWindow | null} */
let mainWindow = null;
const pendingFiles = collectMediaArgs(
  process.argv.slice(app.isPackaged ? 1 : 2),
);

function sendOpenFiles(filePaths) {
  if (filePaths.length === 0) return;
  mainWindow.webContents.send(
    "media:open-files",
    filePaths.map(toMediaDescriptor),
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: "#0f1115",
    title: "Player",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.once("did-finish-load", () =>
    sendOpenFiles(pendingFiles.splice(0)),
  );
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("render-process-gone", (_event, { reason }) => {
    console.error(`Renderer process gone (${reason}), reloading`);
    if (reason !== "clean-exit") mainWindow.reload();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
}

function focusWindow() {
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (!mainWindow) return;
    focusWindow();
    sendOpenFiles(collectMediaArgs(argv.slice(1)));
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    if (mainWindow) sendOpenFiles([filePath]);
    else pendingFiles.push(filePath);
  });

  app.whenReady().then(() => {
    const getWindow = () => mainWindow;
    relaxCorsForMedia();
    registerIpcHandlers(getWindow);
    buildMenu(getWindow, { isDev });
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
