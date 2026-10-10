"use strict";

const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("desktop", {
  openMediaDialog: () => ipcRenderer.invoke("dialog:open-media"),
  openSubtitlesDialog: () => ipcRenderer.invoke("dialog:open-subtitles"),
  saveScreenshot: (dataUrl, suggestedName) =>
    ipcRenderer.invoke("dialog:save-screenshot", { dataUrl, suggestedName }),
  probeMediaUrl: (url) => ipcRenderer.invoke("media:probe-url", url),
  setTitle: (title) => ipcRenderer.send("window:set-title", title),
  onMenuCommand: (callback) => subscribe("menu:command", callback),
  onOpenFiles: (callback) => subscribe("media:open-files", callback),
});
