const fs = require("fs");
const path = require("path");
const os = require("os");

const HOOK_EVENTS = ["Stop", "UserPromptSubmit", "PreToolUse", "Notification"];

function createHookConfig(port, homeDir) {
  const home = homeDir || os.homedir();

  function makeHookEntry(tabId) {
    return {
      matcher: "",
      hooks: [
        {
          type: "http",
          url: `http://localhost:${port}/hooks/ccd-${tabId}`,
        },
      ],
    };
  }

  function getSettingsPath(workspaceDir, scope) {
    if (scope === "global") {
      return path.join(home, ".claude", "settings.json");
    }
    return path.join(workspaceDir, ".claude", "settings.local.json");
  }

  function readSettings(settingsPath) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    } catch {
      return {};
    }
  }

  function writeSettings(settingsPath, settings) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }

  function isOurHook(hookEntry, tabId) {
    return hookEntry.hooks?.some(
      (h) => h.type === "http" && h.url?.includes(`ccd-${tabId}`),
    );
  }

  function isAnyCcdHook(hookEntry) {
    return hookEntry.hooks?.some(
      (h) => h.type === "http" && /\/hooks\/ccd-/.test(h.url),
    );
  }

  function install(workspaceDir, tabId, scope) {
    const settingsPath = getSettingsPath(workspaceDir, scope);
    const settings = readSettings(settingsPath);
    if (!settings.hooks) settings.hooks = {};

    const entry = makeHookEntry(tabId);
    for (const event of HOOK_EVENTS) {
      if (!settings.hooks[event]) settings.hooks[event] = [];
      // Remove any existing entry for this tab
      settings.hooks[event] = settings.hooks[event].filter(
        (e) => !isOurHook(e, tabId),
      );
      settings.hooks[event].push(entry);
    }

    writeSettings(settingsPath, settings);
  }

  function uninstall(workspaceDir, tabId, scope) {
    const settingsPath = getSettingsPath(workspaceDir, scope);
    const settings = readSettings(settingsPath);
    if (!settings.hooks) return;

    for (const event of HOOK_EVENTS) {
      if (!settings.hooks[event]) continue;
      settings.hooks[event] = settings.hooks[event].filter(
        (e) => !isOurHook(e, tabId),
      );
    }

    writeSettings(settingsPath, settings);
  }

  function uninstallAll(workspaceDir, scope) {
    const settingsPath = getSettingsPath(workspaceDir, scope);
    const settings = readSettings(settingsPath);
    if (!settings.hooks) return;
    let changed = false;
    for (const event of HOOK_EVENTS) {
      if (!settings.hooks[event]) continue;
      const before = settings.hooks[event].length;
      settings.hooks[event] = settings.hooks[event].filter(
        (e) => !isAnyCcdHook(e),
      );
      if (settings.hooks[event].length !== before) changed = true;
    }
    if (changed) writeSettings(settingsPath, settings);
  }

  return { install, uninstall, uninstallAll };
}

module.exports = { createHookConfig };
