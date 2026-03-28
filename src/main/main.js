const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
  Notification,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const ptyManager = require("./pty-manager");
const sessionStore = require("./session-store");
const { createHookServer } = require("./hook-server");
const { createHookConfig } = require("./hook-config");

let mainWindow;
let hookServer;
let hookConfig;
const tabDirectories = new Map(); // tabId → directory

function createWindow(sessionData) {
  const win = sessionData?.window || sessionStore.DEFAULT_SESSION.window;

  mainWindow = new BrowserWindow({
    x: win.x,
    y: win.y,
    width: win.width || 1200,
    height: win.height || 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: "#1e1e2e",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 10 },
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  mainWindow.on("close", () => {
    saveSessionFromMain();
  });
}

// IPC: PTY management
ipcMain.on("pty:spawn", (event, tabId, directory) => {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) return;
  tabDirectories.set(tabId, directory);

  // Install hooks for state detection
  if (hookConfig) {
    const data = sessionStore.load() || sessionStore.DEFAULT_SESSION;
    const scope = data.hooksScope || "project";
    try {
      hookConfig.install(directory, tabId, scope);
    } catch {
      // Non-fatal — status indicators won't work but terminal still functions
    }
  }

  ptyManager.spawn(
    tabId,
    directory,
    (id, data) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("pty:data", id, data);
      }
    },
    (id, exitCode) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("pty:exit", id, exitCode);
      }
      // Clean up hooks on exit
      if (hookConfig && tabDirectories.has(id)) {
        const dir = tabDirectories.get(id);
        const sessionData = sessionStore.load() || sessionStore.DEFAULT_SESSION;
        const scope = sessionData.hooksScope || "project";
        try {
          hookConfig.uninstall(dir, id, scope);
        } catch {
          // ignore cleanup errors
        }
      }
    },
  );
});

ipcMain.on("pty:write", (_event, tabId, data) => {
  ptyManager.write(tabId, data);
});

ipcMain.on("pty:resize", (_event, tabId, cols, rows) => {
  if (
    typeof cols !== "number" ||
    typeof rows !== "number" ||
    cols < 1 ||
    cols > 1000 ||
    rows < 1 ||
    rows > 1000
  )
    return;
  ptyManager.resize(tabId, cols, rows);
});

ipcMain.on("pty:kill", (_event, tabId) => {
  // Clean up hooks before killing
  if (hookConfig && tabDirectories.has(tabId)) {
    const dir = tabDirectories.get(tabId);
    const data = sessionStore.load() || sessionStore.DEFAULT_SESSION;
    const scope = data.hooksScope || "project";
    try {
      hookConfig.uninstall(dir, tabId, scope);
    } catch {
      // ignore cleanup errors
    }
    tabDirectories.delete(tabId);
  }
  if (hookServer) hookServer.removeTab(tabId);
  ptyManager.kill(tabId);
});

ipcMain.handle("pty:cwd", (_event, tabId) => {
  return ptyManager.getCwd(tabId);
});

// IPC: Session persistence
ipcMain.handle("sessions:save", (_event, sessionData) => {
  if (
    !sessionData ||
    typeof sessionData !== "object" ||
    !Array.isArray(sessionData.tabs)
  )
    return;
  sessionStore.save(sessionData);
});

ipcMain.handle("sessions:load", () => {
  return sessionStore.load();
});

// IPC: Workspace tracking
ipcMain.handle("workspace:track", (_event, dirPath) => {
  if (typeof dirPath !== "string" || !path.isAbsolute(dirPath)) return;
  sessionStore.trackWorkspace(dirPath);
});

ipcMain.handle("workspace:recent", () => {
  const data = sessionStore.load();
  return (data && data.recentWorkspaces) || [];
});

// IPC: Directory picker
ipcMain.handle("dirs:list-workspace", () => {
  const sessionData = sessionStore.load();
  const workspaceDir =
    (sessionData && sessionData.workspaceDir) ||
    sessionStore.DEFAULT_SESSION.workspaceDir;
  try {
    const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, path: path.join(workspaceDir, e.name) }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  } catch {
    return [];
  }
});

ipcMain.handle("dirs:open-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    defaultPath: os.homedir(),
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// IPC: Tab state (from hook server)
ipcMain.handle("tab:state", (_event, tabId) => {
  if (!hookServer) return null;
  return hookServer.getState(tabId);
});

// IPC: Settings
ipcMain.handle("settings:load", () => {
  const data = sessionStore.load() || sessionStore.DEFAULT_SESSION;
  return {
    workspaceDir:
      data.workspaceDir || sessionStore.DEFAULT_SESSION.workspaceDir,
    hooksScope: data.hooksScope || "project",
  };
});

ipcMain.handle("settings:save", (_event, settings) => {
  if (!settings || typeof settings !== "object") return;
  const data = sessionStore.load() || sessionStore.DEFAULT_SESSION;
  if (typeof settings.workspaceDir === "string") {
    data.workspaceDir = settings.workspaceDir;
  }
  if (settings.hooksScope === "project" || settings.hooksScope === "global") {
    data.hooksScope = settings.hooksScope;
  }
  sessionStore.save(data);
});

// IPC: Utility
ipcMain.handle("util:home-path", () => os.homedir());

ipcMain.handle("util:open-external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    return shell.openExternal(url);
  }
});

ipcMain.handle("util:window-bounds", () => {
  if (!mainWindow) return null;
  const bounds = mainWindow.getBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
});

// Save session from main process (captures bounds before window is destroyed)
function saveSessionFromMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    // Read current session and update window bounds
    const existing = sessionStore.load() || sessionStore.DEFAULT_SESSION;
    existing.window = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
    sessionStore.save(existing);
  } catch {
    // Window already destroyed — nothing to save
  }
}

// App lifecycle
app.whenReady().then(async () => {
  // Start hook server for Claude Code state detection
  hookServer = createHookServer((tabId, state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("tab:state-change", tabId, state);

      // Send native notification for important state changes when window is not focused
      if (
        (state === "waiting" || state === "idle") &&
        !mainWindow.isFocused()
      ) {
        const dir = tabDirectories.get(tabId);
        const title =
          state === "waiting"
            ? "Claude needs your input"
            : "Claude finished working";
        const body = dir ? path.basename(dir) : tabId;
        const notification = new Notification({ title, body });
        notification.on("click", () => {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send("notification:click", tabId);
        });
        notification.show();
      }
    }
  });
  const hookPort = await hookServer.start();
  hookConfig = createHookConfig(hookPort);

  const sessionData = sessionStore.load() || sessionStore.DEFAULT_SESSION;
  createWindow(sessionData);

  const template = [
    { role: "appMenu" },
    {
      label: "File",
      submenu: [
        {
          label: "New Tab",
          accelerator: "CmdOrCtrl+T",
          click: () => mainWindow?.webContents.send("menu:new-tab"),
        },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => mainWindow?.webContents.send("menu:close-tab"),
        },
        { type: "separator" },
        {
          label: "Settings...",
          accelerator: "CmdOrCtrl+,",
          click: () => mainWindow?.webContents.send("menu:open-settings"),
        },
      ],
    },
    { role: "editMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});

app.on("window-all-closed", () => {
  ptyManager.killAll();
  app.quit();
});

app.on("before-quit", () => {
  ptyManager.killAll();
  if (hookServer) hookServer.stop();
});
