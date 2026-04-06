const fs = require("fs");
const path = require("path");
const os = require("os");

function createStore(homeDir) {
  const home = homeDir || os.homedir();
  const configDir = path.join(home, ".config", "claude-code-desktop");
  const sessionFile = path.join(configDir, "sessions.json");

  const DEFAULT_SESSION = {
    version: 1,
    window: { x: undefined, y: undefined, width: 1200, height: 800 },
    sidebarWidth: 200,
    tabs: [],
    activeTabIndex: 0,
    recentWorkspaces: [],
    workspaceDir: path.join(home, "workspace"),
    theme: "Catppuccin Mocha",
    fontFamily: '"MesloLGS Nerd Font", Menlo, Monaco, "Courier New", monospace',
    fontSize: 14,
  };

  function load() {
    try {
      const data = fs.readFileSync(sessionFile, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && parsed.version === 1 && Array.isArray(parsed.tabs)) {
        parsed.tabs = parsed.tabs.map((tab) => {
          if (!fs.existsSync(tab.directory)) {
            return { ...tab, directory: home, _originalDir: tab.directory };
          }
          return tab;
        });
        return parsed;
      }
    } catch {
      // Corrupted or missing — use defaults
    }
    return null;
  }

  function save(sessionData) {
    try {
      // Merge with existing data to preserve fields like recentWorkspaces
      let existing = {};
      try {
        existing = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
      } catch {
        // No existing file
      }
      const clean = {
        ...existing,
        ...sessionData,
        tabs: (sessionData.tabs || []).map(({ _originalDir, ...tab }) => tab),
      };
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(sessionFile, JSON.stringify(clean, null, 2));
      return { success: true };
    } catch (err) {
      console.error("Failed to save session:", err.message);
      return { success: false, error: err.message };
    }
  }

  function trackWorkspace(dirPath) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
    } catch {
      data = JSON.parse(JSON.stringify(DEFAULT_SESSION));
    }
    const recents = data.recentWorkspaces || [];
    const existingIdx = recents.findIndex((r) => r.path === dirPath);
    let entry;
    if (existingIdx >= 0) {
      entry = recents.splice(existingIdx, 1)[0];
      entry.count += 1;
      entry.lastUsed = Date.now();
    } else {
      entry = { path: dirPath, count: 1, lastUsed: Date.now() };
    }
    // Most recent always goes to front
    recents.unshift(entry);
    data.recentWorkspaces = recents;
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
  }

  return { load, save, trackWorkspace, DEFAULT_SESSION };
}

// Default instance for production use
const defaultStore = createStore();

module.exports = { ...defaultStore, createStore };
