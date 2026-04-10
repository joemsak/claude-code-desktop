import { builtinThemes, getThemeByName, DEFAULT_THEME_NAME } from "./themes.js";

/**
 * Creates a settings UI controller.
 * @param {Object} deps
 * @param {Object} deps.dom - DOM element references
 * @param {Object} deps.electronAPI - Electron IPC bridge
 * @param {Function} deps.getActiveTab - Returns currently active tab
 * @param {Function} deps.getState - Returns { fontFamily, fontSize, dangerousMode }
 * @param {Function} deps.onThemeChange - Called with (theme) when theme changes
 * @param {Function} deps.onFontChange - Called with ({ fontFamily, fontSize }) when font changes
 * @param {Function} deps.onDangerousModeChange - Called with (enabled) when dangerous mode toggle changes
 */
export function createSettings({
  dom,
  electronAPI,
  getActiveTab,
  getState,
  onThemeChange,
  onFontChange,
  onDangerousModeChange,
}) {
  const {
    overlay,
    closeBtn,
    workspaceDir,
    browseBtn,
    themeSelect,
    fontFamily,
    fontSize,
    openThemes,
    dangerousToggle,
  } = dom;

  async function open() {
    const settings = await electronAPI.loadSettings();
    const state = getState();
    workspaceDir.value = settings.workspaceDir || "";

    // Populate theme dropdown
    const customThemes = await electronAPI.listCustomThemes();
    themeSelect.innerHTML = "";
    for (const theme of builtinThemes) {
      const opt = document.createElement("option");
      opt.value = theme.name;
      opt.textContent = theme.name;
      themeSelect.appendChild(opt);
    }
    if (customThemes.length > 0) {
      const sep = document.createElement("option");
      sep.disabled = true;
      sep.textContent = "--- Custom ---";
      themeSelect.appendChild(sep);
      for (const theme of customThemes) {
        const opt = document.createElement("option");
        opt.value = theme.name;
        opt.textContent = theme.name;
        themeSelect.appendChild(opt);
      }
    }
    themeSelect.value = settings.theme || DEFAULT_THEME_NAME;

    // Font settings
    fontFamily.value = settings.fontFamily || state.fontFamily;
    fontSize.value = settings.fontSize || state.fontSize;
    dangerousToggle.checked = settings.defaultDangerousMode || false;

    overlay.classList.remove("hidden");
    themeSelect.focus();
  }

  function close() {
    overlay.classList.add("hidden");
    const tab = getActiveTab();
    if (tab) tab.terminal.focus();
  }

  async function saveValue(key, value) {
    await electronAPI.saveSettings({ [key]: value });
  }

  // Wire up DOM events
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  workspaceDir.addEventListener("change", () => {
    saveValue("workspaceDir", workspaceDir.value);
  });

  browseBtn.addEventListener("click", async () => {
    const dir = await electronAPI.openDirectoryDialog();
    if (dir) {
      workspaceDir.value = dir;
      saveValue("workspaceDir", dir);
    }
  });

  themeSelect.addEventListener("change", async () => {
    const name = themeSelect.value;
    const customThemes = await electronAPI.listCustomThemes();
    const theme = getThemeByName(name, customThemes);
    onThemeChange(theme);
    await electronAPI.saveSettings({
      theme: name,
      themeBaseColor: theme.chrome.base,
    });
  });

  fontFamily.addEventListener("change", () => {
    onFontChange({ fontFamily: fontFamily.value });
    saveValue("fontFamily", fontFamily.value);
  });

  fontSize.addEventListener("change", () => {
    const size = parseInt(fontSize.value, 10);
    if (size >= 8 && size <= 32) {
      onFontChange({ fontSize: size });
      saveValue("fontSize", size);
    }
  });

  openThemes.addEventListener("click", () => {
    electronAPI.openThemesFolder();
  });

  dangerousToggle.addEventListener("change", () => {
    onDangerousModeChange(dangerousToggle.checked);
  });

  electronAPI.onOpenSettings(() => open());

  return { open, close };
}
