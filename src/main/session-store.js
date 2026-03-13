const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".config", "claude-code-desktop");
const SESSION_FILE = path.join(CONFIG_DIR, "sessions.json");

const DEFAULT_SESSION = {
  version: 1,
  window: { x: undefined, y: undefined, width: 1200, height: 800 },
  sidebarWidth: 200,
  tabs: [{ directory: os.homedir(), customName: null }],
  activeTabIndex: 0,
};

function load() {
  try {
    const data = fs.readFileSync(SESSION_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (
      parsed &&
      parsed.version === 1 &&
      Array.isArray(parsed.tabs) &&
      parsed.tabs.length > 0
    ) {
      parsed.tabs = parsed.tabs.map((tab) => {
        if (!fs.existsSync(tab.directory)) {
          return {
            ...tab,
            directory: os.homedir(),
            _originalDir: tab.directory,
          };
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
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
  } catch (err) {
    console.error("Failed to save session:", err.message);
  }
}

module.exports = { load, save, DEFAULT_SESSION };
