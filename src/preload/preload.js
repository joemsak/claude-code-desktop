const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // PTY management
  spawnPty: (tabId, directory, options) =>
    ipcRenderer.send("pty:spawn", tabId, directory, options),
  writePty: (tabId, data) => ipcRenderer.send("pty:write", tabId, data),
  resizePty: (tabId, cols, rows) =>
    ipcRenderer.send("pty:resize", tabId, cols, rows),
  killPty: (tabId) => ipcRenderer.send("pty:kill", tabId),
  getPtyCwd: (tabId) => ipcRenderer.invoke("pty:cwd", tabId),

  // PTY events (main -> renderer)
  onPtyData: (callback) =>
    ipcRenderer.on("pty:data", (_event, tabId, data) => callback(tabId, data)),
  onPtyExit: (callback) =>
    ipcRenderer.on("pty:exit", (_event, tabId, exitCode) =>
      callback(tabId, exitCode),
    ),

  // Menu events (main -> renderer)
  onNewTab: (callback) => ipcRenderer.on("menu:new-tab", () => callback()),
  onNewTabDangerous: (callback) =>
    ipcRenderer.on("menu:new-tab-dangerous", () => callback()),
  onCloseTab: (callback) => ipcRenderer.on("menu:close-tab", () => callback()),
  rebuildMenu: (defaultDangerous) =>
    ipcRenderer.invoke("menu:rebuild", defaultDangerous),
  onOpenSettings: (callback) =>
    ipcRenderer.on("menu:open-settings", () => callback()),

  // Settings
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),

  // Themes
  listCustomThemes: () => ipcRenderer.invoke("themes:list-custom"),
  openThemesFolder: () => ipcRenderer.invoke("themes:open-folder"),

  // Session persistence
  saveSessions: (sessionData) =>
    ipcRenderer.invoke("sessions:save", sessionData),
  loadSessions: () => ipcRenderer.invoke("sessions:load"),

  // Directory picker
  listWorkspaceDirs: () => ipcRenderer.invoke("dirs:list-workspace"),
  openDirectoryDialog: () => ipcRenderer.invoke("dirs:open-dialog"),
  trackWorkspace: (dirPath) => ipcRenderer.invoke("workspace:track", dirPath),
  getRecentWorkspaces: () => ipcRenderer.invoke("workspace:recent"),

  // Utility
  getHomePath: () => ipcRenderer.invoke("util:home-path"),
  getWindowBounds: () => ipcRenderer.invoke("util:window-bounds"),
  openExternal: (url) => ipcRenderer.invoke("util:open-external", url),
});
