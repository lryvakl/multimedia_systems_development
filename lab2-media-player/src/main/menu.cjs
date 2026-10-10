"use strict";

const { app, Menu, dialog } = require("electron");

const isMac = process.platform === "darwin";
const separator = { type: "separator" };

function showAbout(window) {
  dialog.showMessageBox(window, {
    type: "info",
    title: "About",
    message: "Player",
    detail:
      `Version ${app.getVersion()}\n` +
      'Lab work No. 2, "Multimedia Systems Development".\n' +
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
  });
}

/**
 * Menu items only forward commands to the renderer, so menu, buttons and hotkeys
 * share one code path. Single-key accelerators are display-only
 * (registerAccelerator: false) to keep them from firing inside text inputs.
 *
 * @param {() => import('electron').BrowserWindow | null} getWindow
 */
function buildMenu(getWindow, { isDev }) {
  const command = (label, name, accelerator, { displayOnly = false } = {}) => ({
    label,
    accelerator,
    registerAccelerator: !displayOnly,
    click: () => getWindow()?.webContents.send("menu:command", name),
  });
  const hint = (label, name, accelerator) =>
    command(label, name, accelerator, { displayOnly: true });

  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "File",
      submenu: [
        command("Open File…", "open-file", "CmdOrCtrl+O"),
        command("Open URL…", "open-url", "CmdOrCtrl+U"),
        command("Load Subtitles…", "open-subtitles", "CmdOrCtrl+T"),
        separator,
        command("Save Frame (PNG)", "screenshot", "CmdOrCtrl+Shift+S"),
        command("Clear Playlist", "clear-playlist"),
        ...(isMac ? [] : [separator, { role: "quit", label: "Quit" }]),
      ],
    },
    {
      label: "Playback",
      submenu: [
        hint("Play / Pause", "toggle-play", "Space"),
        hint("Stop", "stop", "S"),
        separator,
        hint("Forward 10 s", "forward", "Right"),
        hint("Back 10 s", "backward", "Left"),
        separator,
        command("Next Track", "next", "CmdOrCtrl+Right"),
        command("Previous Track", "previous", "CmdOrCtrl+Left"),
        separator,
        hint("Volume Up", "volume-up", "Up"),
        hint("Volume Down", "volume-down", "Down"),
        hint("Mute", "mute", "M"),
      ],
    },
    {
      label: "View",
      submenu: [
        hint("Full Screen", "fullscreen", "F"),
        hint("Picture-in-Picture", "pip", "I"),
        command("Show/Hide Playlist", "toggle-playlist", "CmdOrCtrl+L"),
        separator,
        { role: "resetZoom", label: "Actual Size" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        ...(isDev
          ? [separator, { role: "reload" }, { role: "toggleDevTools" }]
          : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        command("Keyboard Shortcuts", "show-help", "F1"),
        { label: "About", click: () => showAbout(getWindow()) },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
