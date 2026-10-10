"use strict";

const { app, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const {
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  SUBTITLE_EXTENSIONS,
} = require("../shared/formats.js");
const { toMediaDescriptor } = require("./media-files.cjs");
const { probeMediaUrl } = require("./url-probe.cjs");

const MEDIA_FILTERS = [
  {
    name: "All media files",
    extensions: [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS],
  },
  { name: "Audio", extensions: AUDIO_EXTENSIONS },
  { name: "Video", extensions: VIDEO_EXTENSIONS },
  { name: "All files", extensions: ["*"] },
];
const PNG_DATA_URL = /^data:image\/png;base64,(.+)$/;
const APP_TITLE = "Player";

/** @param {() => import('electron').BrowserWindow | null} getWindow */
function registerIpcHandlers(getWindow) {
  ipcMain.handle("dialog:open-media", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
      title: "Open media files",
      properties: ["openFile", "multiSelections"],
      filters: MEDIA_FILTERS,
    });
    return canceled ? [] : filePaths.map(toMediaDescriptor);
  });

  ipcMain.handle("dialog:open-subtitles", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
      title: "Open subtitles",
      properties: ["openFile"],
      filters: [{ name: "Subtitles", extensions: SUBTITLE_EXTENSIONS }],
    });
    if (canceled || filePaths.length === 0) return null;
    const [filePath] = filePaths;
    return {
      name: path.basename(filePath),
      text: await fs.readFile(filePath, "utf8"),
    };
  });

  ipcMain.handle(
    "dialog:save-screenshot",
    async (_event, { dataUrl, suggestedName }) => {
      const match = PNG_DATA_URL.exec(String(dataUrl));
      if (!match) throw new Error("Invalid screenshot data");
      const { canceled, filePath } = await dialog.showSaveDialog(getWindow(), {
        title: "Save frame",
        defaultPath: path.join(
          app.getPath("pictures"),
          suggestedName || "frame.png",
        ),
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (canceled || !filePath) return null;
      await fs.writeFile(filePath, Buffer.from(match[1], "base64"));
      return filePath;
    },
  );

  ipcMain.handle("media:probe-url", (_event, url) => probeMediaUrl(url));

  ipcMain.on("window:set-title", (_event, title) => {
    getWindow()?.setTitle(title ? `${title} — ${APP_TITLE}` : APP_TITLE);
  });
}

module.exports = { registerIpcHandlers };
