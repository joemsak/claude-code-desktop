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
    tabs: [{ directory: home, customName: null }],
    activeTabIndex: 0,
  };

  function load() {
    try {
      const data = fs.readFileSync(sessionFile, "utf-8");
      const parsed = JSON.parse(data);
      if (
        parsed &&
        parsed.version === 1 &&
        Array.isArray(parsed.tabs) &&
        parsed.tabs.length > 0
      ) {
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
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
    } catch (err) {
      console.error("Failed to save session:", err.message);
    }
  }

  return { load, save, DEFAULT_SESSION };
}

// Default instance for production use
const defaultStore = createStore();

module.exports = { ...defaultStore, createStore };
