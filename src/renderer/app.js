import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { getThemeByName, applyTheme, DEFAULT_THEME_NAME } from "./themes.js";
import Sortable from "sortablejs";
import { createPicker } from "./picker.js";
import { createSettings } from "./settings.js";
import { createCloneOrchestrator } from "./clone-flow.js";
import {
  basename,
  getDisplayName as getDisplayNamePure,
  filterED3,
  isEffectiveDangerous as isEffectiveDangerousPure,
} from "./utils.js";

const { electronAPI } = window;

// --- State ---
let tabs = []; // [{ id, directory, customName, terminal, fitAddon, wrapper, exited, _originalDir }]
let activeTabId = null;
let sidebarWidth = 200;
let saveTimeout = null;
let homePath = "";
let currentTheme = null;
let currentFontFamily =
  '"MesloLGS Nerd Font", "JetBrainsMono Nerd Font", Menlo, Monaco, "Courier New", monospace';
let currentFontSize = 14;
let defaultDangerousMode = false;
let shiftHeld = false;

// --- DOM refs ---
const tabListEl = document.getElementById("tab-list");
const terminalContainer = document.getElementById("terminal-container");
const pickerOverlay = document.getElementById("picker-overlay");
const pickerSearch = document.getElementById("picker-search");
const pickerList = document.getElementById("picker-list");
const pickerModal = document.getElementById("picker-modal");
const sidebarEl = document.getElementById("sidebar");
const resizeHandle = document.getElementById("sidebar-resize-handle");
const emptyStateEl = document.getElementById("empty-state");
const topbarPathEl = document.getElementById("topbar-path");
const topbarNameEl = document.getElementById("topbar-name");
const emptyStateOpenBtn = document.getElementById("empty-state-open-btn");
const emptyStateRecents = document.getElementById("empty-state-recents");
const emptyStateShiftHint = document.getElementById("empty-state-shift-hint");
const followIndicator = document.getElementById("follow-indicator");
const topbarEl = document.getElementById("topbar");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsCloseBtn = document.getElementById("settings-close");
const settingsWorkspaceDir = document.getElementById("settings-workspace-dir");
const settingsBrowseBtn = document.getElementById("settings-browse-btn");
const settingsThemeSelect = document.getElementById("settings-theme");
const settingsFontFamily = document.getElementById("settings-font-family");
const settingsFontSize = document.getElementById("settings-font-size");
const settingsOpenThemes = document.getElementById("settings-open-themes");
const settingsDangerousToggle = document.getElementById(
  "settings-dangerous-toggle",
);
const confirmOverlay = document.getElementById("confirm-dangerous-overlay");
const confirmDangerousBtn = document.getElementById("confirm-dangerous-btn");
const confirmNormalBtn = document.getElementById("confirm-normal-btn");
const confirmSettingsLink = document.getElementById("confirm-settings-link");
const confirmNote = document.getElementById("confirm-dangerous-note");

// ===========================
// Helpers
// ===========================

function getActiveTab() {
  return tabs.find((t) => t.id === activeTabId);
}

function isAtBottom(terminal) {
  const buf = terminal.buffer.active;
  return buf.viewportY >= buf.baseY;
}

function updateFollowIndicator() {
  const tab = getActiveTab();
  if (!tab) {
    followIndicator.classList.add("hidden");
    return;
  }
  followIndicator.classList.remove("hidden");
  if (isAtBottom(tab.terminal)) {
    followIndicator.textContent = "Following \u2193";
    followIndicator.classList.add("following");
  } else {
    followIndicator.textContent = "Follow \u2193";
    followIndicator.classList.remove("following");
  }
}

function refitActiveTerminal() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.fitAddon.fit();
  electronAPI.resizePty(tab.id, tab.terminal.cols, tab.terminal.rows);
}

function getDisplayName(tab) {
  return getDisplayNamePure(tab, tabs);
}

// ===========================
// UI State Updates
// ===========================

function updateTopbar() {
  const tab = getActiveTab();
  topbarPathEl.textContent = tab ? tab.directory.replace(homePath, "~") : "";
  topbarNameEl.textContent = tab ? getDisplayName(tab) : "";

  // Warning/exited/dangerous states
  topbarPathEl.classList.remove("topbar-exited", "topbar-warning");
  topbarNameEl.classList.remove("topbar-exited", "topbar-warning");
  topbarEl.classList.remove("topbar-dangerous");
  if (tab && tab.exited) {
    topbarPathEl.classList.add("topbar-exited");
    topbarNameEl.classList.add("topbar-exited");
  } else if (tab && tab._originalDir) {
    topbarPathEl.classList.add("topbar-warning");
    topbarNameEl.classList.add("topbar-warning");
  }
  if (tab && tab.dangerousMode) {
    topbarEl.classList.add("topbar-dangerous");
  }
}

function isEffectiveDangerous() {
  return isEffectiveDangerousPure(shiftHeld, defaultDangerousMode);
}

function getModeLabels(isDangerous) {
  return {
    buttonText: isDangerous
      ? "Browse (Skip Permissions)..."
      : "Browse Other...",
    shiftHint: isDangerous
      ? "Hold <kbd>Shift</kbd> for standard mode"
      : "Hold <kbd>Shift</kbd> to skip permissions",
  };
}

async function updateEmptyState() {
  if (tabs.length === 0) {
    emptyStateEl.classList.remove("hidden");
    terminalContainer.classList.add("hidden");
    await renderEmptyStateRecents();
    // Apply default-dangerous styling and hint text
    emptyStateEl.classList.toggle(
      "empty-default-dangerous",
      defaultDangerousMode,
    );
    const labels = getModeLabels(defaultDangerousMode);
    emptyStateOpenBtn.textContent = labels.buttonText;
    emptyStateShiftHint.innerHTML = labels.shiftHint; // Safe: shiftHint is hardcoded in getModeLabels(), never user-derived
  } else {
    emptyStateEl.classList.add("hidden");
    terminalContainer.classList.remove("hidden");
  }
}

function updateShiftState(pressed) {
  shiftHeld = pressed;

  // Toggle picker dangerous state if picker is open
  if (!pickerOverlay.classList.contains("hidden")) {
    picker.updateDangerousState(isEffectiveDangerous());
  }

  // Only apply empty-state visual transform when empty state is visible
  if (tabs.length > 0) return;

  // Clear previous shift classes
  emptyStateEl.classList.remove(
    "empty-shift-dangerous",
    "empty-shift-standard",
  );

  if (pressed) {
    // Remove default-dangerous so shift-standard can take effect
    emptyStateEl.classList.remove("empty-default-dangerous");
    if (defaultDangerousMode) {
      emptyStateEl.classList.add("empty-shift-standard");
    } else {
      emptyStateEl.classList.add("empty-shift-dangerous");
    }
    emptyStateShiftHint.style.visibility = "hidden";
  } else {
    // Restore default-dangerous if applicable
    emptyStateEl.classList.toggle(
      "empty-default-dangerous",
      defaultDangerousMode,
    );
    emptyStateShiftHint.style.visibility = "";
  }
  const labels = getModeLabels(isEffectiveDangerous());
  emptyStateOpenBtn.textContent = labels.buttonText;
}

async function renderEmptyStateRecents() {
  const recents = await electronAPI.getRecentWorkspaces();
  emptyStateRecents.innerHTML = "";
  if (recents.length === 0) return;

  const label = document.createElement("div");
  label.className = "empty-recents-label";
  label.textContent = "Recent";
  emptyStateRecents.appendChild(label);

  const list = document.createElement("div");
  list.className = "empty-recents-list";

  for (const r of recents.slice(0, 3)) {
    const item = document.createElement("div");
    item.className = "empty-recents-item";

    const name = document.createElement("span");
    name.textContent = basename(r.path);
    item.appendChild(name);

    const pathSpan = document.createElement("span");
    pathSpan.className = "empty-recents-path";
    pathSpan.textContent = r.path.replace(homePath, "~");
    item.appendChild(pathSpan);

    item.addEventListener("click", () => {
      if (isEffectiveDangerous()) {
        showDangerousConfirm(r.path);
      } else {
        createTab(r.path);
      }
    });
    list.appendChild(item);
  }
  emptyStateRecents.appendChild(list);
}

// ===========================
// Sidebar Rendering
// ===========================

function renderSidebar() {
  tabListEl.innerHTML = "";
  for (const tab of tabs) {
    const el = document.createElement("div");
    el.className =
      "tab-entry" +
      (tab.id === activeTabId ? " active" : "") +
      (tab.exited ? " tab-exited" : "") +
      (tab.dangerousMode ? " tab-dangerous" : "");
    el.dataset.tabId = tab.id;
    el.setAttribute("role", "tab");
    el.setAttribute("aria-selected", tab.id === activeTabId ? "true" : "false");

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.innerHTML =
      '<svg width="10" height="12" viewBox="0 0 10 12">' +
      '<circle cx="2.5" cy="2" r="1.2"/><circle cx="7.5" cy="2" r="1.2"/>' +
      '<circle cx="2.5" cy="6" r="1.2"/><circle cx="7.5" cy="6" r="1.2"/>' +
      '<circle cx="2.5" cy="10" r="1.2"/><circle cx="7.5" cy="10" r="1.2"/>' +
      "</svg>";
    el.appendChild(handle);

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = getDisplayName(tab);
    el.appendChild(nameSpan);

    const tooltip = document.createElement("span");
    tooltip.className = "tab-tooltip";
    if (tab._originalDir) {
      el.classList.add("tab-warning");
      tooltip.textContent = `Missing: ${tab._originalDir}`;
      tooltip.classList.add("tab-tooltip-warning");
    } else {
      tooltip.textContent = tab.directory;
    }
    el.appendChild(tooltip);

    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.setAttribute("aria-label", "Close tab");
    closeBtn.innerHTML =
      '<svg viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9"/>' +
      '<line x1="9" y1="1" x2="1" y2="9"/></svg>';
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(closeBtn);

    el.addEventListener("click", () => switchTab(tab.id));

    nameSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      if (tab.id !== activeTabId) switchTab(tab.id);
    });

    nameSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      e.preventDefault();
      startRename(tab, nameSpan);
    });

    tabListEl.appendChild(el);
  }
  initSortable();
}

// ===========================
// Tab Lifecycle
// ===========================

function destroyTab(tab) {
  electronAPI.killPty(tab.id);
  tab.terminal.dispose();
  tab.wrapper.remove();
  const index = tabs.indexOf(tab);
  if (index >= 0) tabs.splice(index, 1);
}

function createTab(
  directory,
  customName = null,
  originalDir = null,
  options = {},
) {
  const id = options.tabId || crypto.randomUUID();
  const terminal = new Terminal({
    theme: currentTheme
      ? currentTheme.terminal
      : getThemeByName(DEFAULT_THEME_NAME).terminal,
    fontFamily: currentFontFamily,
    fontSize: currentFontSize,
    scrollback: 5000,
    cursorBlink: true,
    allowProposedApi: true,
    linkHandler: {
      activate: (_event, text, _range) => {
        electronAPI.openExternal(text);
      },
    },
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(
    new WebLinksAddon((_event, url) => {
      electronAPI.openExternal(url);
    }),
  );

  const wrapper = document.createElement("div");
  wrapper.className = "terminal-wrapper";
  wrapper.id = `terminal-${id}`;
  terminalContainer.appendChild(wrapper);
  terminal.open(wrapper);

  const tab = {
    id,
    directory,
    customName,
    terminal,
    fitAddon,
    wrapper,
    exited: false,
    _originalDir: originalDir,
    dangerousMode: !!options.dangerousMode,
  };
  tabs.push(tab);

  terminal.element.addEventListener("wheel", () => {
    requestAnimationFrame(() => updateFollowIndicator());
  });
  terminal.onScroll(() => updateFollowIndicator());

  terminal.onData((data) => {
    if (tab.exited) {
      if (data === "\r") restartTab(tab);
      return;
    }
    electronAPI.writePty(id, data);
  });

  if (!options.skipSpawn) {
    electronAPI.spawnPty(id, directory, {
      dangerousMode: !!options.dangerousMode,
    });
    electronAPI.trackWorkspace(directory);
  }
  updateEmptyState();
  switchTab(id);
  // Delayed refit for first tab after empty state (container was display:none)
  setTimeout(() => {
    if (tab.id === activeTabId) refitActiveTerminal();
  }, 100);
  scheduleSave();
  startCwdTracking();
  return tab;
}

function switchTab(tabId) {
  activeTabId = tabId;
  for (const tab of tabs) {
    const isActive = tab.id === tabId;
    tab.wrapper.classList.toggle("active", isActive);
    if (isActive) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          tab.fitAddon.fit();
          electronAPI.resizePty(tab.id, tab.terminal.cols, tab.terminal.rows);
          tab.terminal.focus();
          updateFollowIndicator();
        });
      });
    }
  }
  renderSidebar();
  updateTopbar();
}

function closeTab(tabId) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;

  const index = tabs.indexOf(tab);
  destroyTab(tab);
  updateEmptyState();

  if (tabs.length === 0) {
    activeTabId = null;
    renderSidebar();
    updateTopbar();
    updateFollowIndicator();
  } else if (activeTabId === tabId) {
    switchTab(tabs[Math.min(index, tabs.length - 1)].id);
  } else {
    renderSidebar();
  }
  scheduleSave();
}

function restartTab(tab) {
  tab.exited = false;
  tab.terminal.clear();
  electronAPI.spawnPty(tab.id, tab.directory, {
    dangerousMode: tab.dangerousMode,
  });
}

// ===========================
// Inline Rename
// ===========================

function startRename(tab, nameSpan) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "rename-input";
  input.value = getDisplayName(tab);
  nameSpan.replaceWith(input);
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });

  input.addEventListener("mousedown", (e) => e.stopPropagation());
  input.addEventListener("click", (e) => e.stopPropagation());

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    if (save && input.value.trim()) {
      tab.customName = input.value.trim();
    }
    input.replaceWith(nameSpan);
    nameSpan.textContent = getDisplayName(tab);
    if (save) scheduleSave();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
    e.stopPropagation();
  });
  input.addEventListener("blur", () => finish(true));
}

// ===========================
// Drag Reorder (SortableJS)
// ===========================

function initSortable() {
  if (tabListEl._sortable) tabListEl._sortable.destroy();
  tabListEl._sortable = new Sortable(tabListEl, {
    animation: 150,
    handle: ".drag-handle",
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    onEnd: (evt) => {
      if (evt.oldIndex === evt.newIndex) return;
      const [moved] = tabs.splice(evt.oldIndex, 1);
      tabs.splice(evt.newIndex, 0, moved);
      updateTopbar();
      scheduleSave();
    },
  });
}

// ===========================
// Directory Picker
// ===========================

let pendingDirectory = null;

function createCloningTabForOrchestrator(tabId, name) {
  createTab(`Cloning ${name}…`, `Cloning ${name}…`, null, {
    tabId,
    skipSpawn: true,
  });
}

function respawnTabInDir(tabId, newDir, { dangerousMode }) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;
  tab.directory = newDir;
  tab.customName = null;
  tab._originalDir = null;
  tab.dangerousMode = !!dangerousMode;
  tab.exited = false;
  tab.terminal.clear();
  electronAPI.spawnPty(tabId, newDir, { dangerousMode: !!dangerousMode });
  renderSidebar();
  updateTopbar();
  scheduleSave();
}

function renderCloneRetryBanner(tabId, retry, closeFn) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;
  clearCloneRetryBanner(tabId);
  const banner = document.createElement("div");
  banner.className = "clone-retry-banner";
  banner.dataset.tabId = tabId;

  const label = document.createElement("span");
  label.textContent = "Clone failed";
  banner.appendChild(label);

  const retryBtn = document.createElement("button");
  retryBtn.textContent = "Retry";
  retryBtn.addEventListener("click", () => retry());
  banner.appendChild(retryBtn);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close tab";
  closeBtn.addEventListener("click", () => closeFn());
  banner.appendChild(closeBtn);

  tab.wrapper.insertBefore(banner, tab.wrapper.firstChild);
}

function clearCloneRetryBanner(tabId) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;
  const existing = tab.wrapper.querySelector(".clone-retry-banner");
  if (existing) existing.remove();
}

const cloneOrchestrator = createCloneOrchestrator({
  electronAPI,
  createCloningTab: createCloningTabForOrchestrator,
  respawnInDir: respawnTabInDir,
  renderRetryBanner: renderCloneRetryBanner,
  clearRetryBanner: clearCloneRetryBanner,
  closeTab,
});

const picker = createPicker({
  dom: {
    overlay: pickerOverlay,
    search: pickerSearch,
    list: pickerList,
    modal: pickerModal,
  },
  electronAPI,
  basename,
  getHomePath: () => homePath,
  getActiveTab,
  onSelect: (directory) => createTab(directory),
  onSelectDangerous: (directory) => showDangerousConfirm(directory),
  onClone: (url) =>
    cloneOrchestrator.clone(url, { dangerousMode: isEffectiveDangerous() }),
  onClose: () => updateEmptyState(),
});

// ===========================
// Dangerous Mode Confirmation
// ===========================

function showDangerousConfirm(directory) {
  pendingDirectory = directory;
  confirmNote.classList.toggle("hidden", !defaultDangerousMode);
  confirmOverlay.classList.remove("hidden");
  confirmDangerousBtn.focus();
}

function closeDangerousConfirm() {
  confirmOverlay.classList.add("hidden");
  pendingDirectory = null;
}

confirmDangerousBtn.addEventListener("click", () => {
  const dir = pendingDirectory;
  closeDangerousConfirm();
  createTab(dir, null, null, { dangerousMode: true });
});

confirmNormalBtn.addEventListener("click", () => {
  const dir = pendingDirectory;
  closeDangerousConfirm();
  createTab(dir);
});

confirmSettingsLink.addEventListener("click", () => {
  closeDangerousConfirm();
  settings.open();
});

confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) {
    closeDangerousConfirm();
  }
});

// ===========================
// Session Persistence
// ===========================

function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveSessionsNow(), 1000);
}

async function saveSessionsNow() {
  const bounds = await electronAPI.getWindowBounds();
  electronAPI.saveSessions({
    version: 1,
    window: bounds || { width: 1200, height: 800 },
    sidebarWidth,
    tabs: tabs.map((t) => ({
      directory: t.directory,
      customName: t.customName,
      dangerousMode: t.dangerousMode || false,
    })),
    activeTabIndex: tabs.findIndex((t) => t.id === activeTabId),
  });
}

// ===========================
// PTY Events
// ===========================

electronAPI.onPtyData((tabId, data) => {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;
  // Strip ED3 when paired with ED2 — see filterED3 in utils.js
  tab.terminal.write(filterED3(data));
});

electronAPI.onPtyExit((tabId, exitCode) => {
  if (cloneOrchestrator.handlePtyExit(tabId, exitCode)) return;
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.exited = true;
    tab.terminal.writeln("");
    tab.terminal.writeln(
      "\x1b[33m[Session ended. Press Enter to restart or Cmd+W to close]\x1b[0m",
    );
    renderSidebar();
  }
});

// ===========================
// Menu Events
// ===========================

electronAPI.onNewTab(() => picker.open(defaultDangerousMode));
electronAPI.onNewTabDangerous(() => picker.open(!defaultDangerousMode));
electronAPI.onCloseTab(() => {
  if (activeTabId) closeTab(activeTabId);
});

// ===========================
// Sidebar Resize
// ===========================

let isResizing = false;
let resizeRafId = null;

resizeHandle.addEventListener("mousedown", (e) => {
  isResizing = true;
  resizeHandle.classList.add("active");
  document.body.style.cursor = "col-resize";
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;
  sidebarWidth = Math.min(400, Math.max(120, e.clientX));
  sidebarEl.style.width = `${sidebarWidth}px`;
  if (!resizeRafId) {
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null;
      refitActiveTerminal();
    });
  }
});

document.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    resizeHandle.classList.remove("active");
    document.body.style.cursor = "";
    refitActiveTerminal();
    scheduleSave();
  }
});

// ===========================
// Keyboard Shortcuts
// ===========================

document.addEventListener("keydown", (e) => {
  if (e.metaKey && !e.shiftKey && e.key >= "1" && e.key <= "9") {
    e.preventDefault();
    const index = parseInt(e.key) - 1;
    if (tabs[index]) switchTab(tabs[index].id);
    return;
  }
  if (e.metaKey && e.shiftKey && e.key === "[") {
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === activeTabId);
    if (i > 0) switchTab(tabs[i - 1].id);
    return;
  }
  if (e.metaKey && e.shiftKey && e.key === "]") {
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === activeTabId);
    if (i < tabs.length - 1) switchTab(tabs[i + 1].id);
    return;
  }
});

window.addEventListener("resize", () => refitActiveTerminal());

followIndicator.addEventListener("click", () => {
  const tab = getActiveTab();
  if (tab) {
    tab.terminal.scrollToBottom();
    updateFollowIndicator();
    tab.terminal.focus();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Shift") updateShiftState(true);
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Shift") updateShiftState(false);
});

window.addEventListener("blur", () => {
  if (shiftHeld) updateShiftState(false);
});

emptyStateOpenBtn.addEventListener("click", () => {
  picker.open(isEffectiveDangerous());
});

// ===========================
// CWD Tracking
// ===========================

let cwdInterval = null;

function startCwdTracking() {
  if (cwdInterval) return;
  cwdInterval = setInterval(async () => {
    if (tabs.length === 0) {
      clearInterval(cwdInterval);
      cwdInterval = null;
      return;
    }
    const tab = getActiveTab();
    if (!tab || tab.exited) return;
    const cwd = await electronAPI.getPtyCwd(tab.id);
    if (cwd && cwd !== tab.directory) {
      tab.directory = cwd;
      renderSidebar();
      updateTopbar();
      scheduleSave();
    }
  }, 3000);
}

function applyThemeToAllTerminals(theme) {
  currentTheme = theme;
  applyTheme(theme);
  for (const tab of tabs) {
    tab.terminal.options.theme = theme.terminal;
  }
}

function applyFontToAllTerminals() {
  document.documentElement.style.setProperty(
    "--terminal-font",
    currentFontFamily,
  );
  for (const tab of tabs) {
    tab.terminal.options.fontFamily = currentFontFamily;
    tab.terminal.options.fontSize = currentFontSize;
    tab.fitAddon.fit();
    electronAPI.resizePty(tab.id, tab.terminal.cols, tab.terminal.rows);
  }
}

// ===========================
// Settings
// ===========================

const settings = createSettings({
  dom: {
    overlay: settingsOverlay,
    closeBtn: settingsCloseBtn,
    workspaceDir: settingsWorkspaceDir,
    browseBtn: settingsBrowseBtn,
    themeSelect: settingsThemeSelect,
    fontFamily: settingsFontFamily,
    fontSize: settingsFontSize,
    openThemes: settingsOpenThemes,
    dangerousToggle: settingsDangerousToggle,
  },
  electronAPI,
  getActiveTab,
  getState: () => ({
    fontFamily: currentFontFamily,
    fontSize: currentFontSize,
    dangerousMode: defaultDangerousMode,
  }),
  onThemeChange: (theme) => applyThemeToAllTerminals(theme),
  onFontChange: ({ fontFamily, fontSize }) => {
    if (fontFamily !== undefined) currentFontFamily = fontFamily;
    if (fontSize !== undefined) currentFontSize = fontSize;
    applyFontToAllTerminals();
  },
  onDangerousModeChange: (enabled) => {
    defaultDangerousMode = enabled;
    electronAPI.saveSettings({ defaultDangerousMode: enabled });
    electronAPI.rebuildMenu(enabled);
  },
});

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    if (!confirmOverlay.classList.contains("hidden")) {
      e.preventDefault();
      const target =
        document.activeElement === confirmDangerousBtn
          ? confirmNormalBtn
          : confirmDangerousBtn;
      target.focus();
    }
    return;
  }
  if (e.key !== "Escape") return;
  if (!confirmOverlay.classList.contains("hidden")) {
    e.preventDefault();
    closeDangerousConfirm();
  } else if (!settingsOverlay.classList.contains("hidden")) {
    e.preventDefault();
    settings.close();
  }
});

// ===========================
// Initialization
// ===========================

async function init() {
  homePath = await electronAPI.getHomePath();
  const sessionData = await electronAPI.loadSessions();
  const data = sessionData || {
    tabs: [],
    activeTabIndex: 0,
    sidebarWidth: 200,
  };

  sidebarWidth = data.sidebarWidth || 200;
  sidebarEl.style.width = `${sidebarWidth}px`;

  // Load settings before updating empty state so dangerous mode is known
  const startupSettings = await electronAPI.loadSettings();
  currentFontFamily = startupSettings.fontFamily || currentFontFamily;
  currentFontSize = startupSettings.fontSize || currentFontSize;
  defaultDangerousMode = startupSettings.defaultDangerousMode || false;
  updateEmptyState();
  const customThemes = await electronAPI.listCustomThemes();
  currentTheme = getThemeByName(
    startupSettings.theme || DEFAULT_THEME_NAME,
    customThemes,
  );
  applyTheme(currentTheme);
  document.documentElement.style.setProperty(
    "--terminal-font",
    currentFontFamily,
  );

  // Wait for @font-face fonts to load before creating terminals.
  // xterm.js canvas renderer measures glyphs at init — if the font isn't
  // ready, it falls back to the next in the chain and glyphs render blank.
  await document.fonts.ready;

  if (!data.tabs || data.tabs.length === 0) {
    // Show welcome screen — user can open picker with Cmd+T or click Browse
  } else {
    for (const tabData of data.tabs) {
      createTab(
        tabData.directory,
        tabData.customName,
        tabData._originalDir || null,
        { dangerousMode: tabData.dangerousMode || false },
      );
    }
    if (data.activeTabIndex >= 0 && data.activeTabIndex < tabs.length) {
      switchTab(tabs[data.activeTabIndex].id);
    }
    setTimeout(() => refitActiveTerminal(), 200);
  }
}

init();
