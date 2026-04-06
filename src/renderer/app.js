import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import {
  builtinThemes,
  getThemeByName,
  applyTheme,
  DEFAULT_THEME_NAME,
} from "./themes.js";
import { fuzzyMatch, fuzzyScore } from "./fuzzy.js";
import { stripTuiChrome } from "./strip-tui-chrome.js";

const { electronAPI } = window;

// --- State ---
let tabs = []; // [{ id, directory, customName, terminal, fitAddon, wrapper, exited, _originalDir }]
let activeTabId = null;
let sidebarWidth = 200;
let saveTimeout = null;
let homePath = "";
let currentTheme = null;
let currentFontFamily =
  '"MesloLGS Nerd Font", Menlo, Monaco, "Courier New", monospace';
let currentFontSize = 14;

// --- DOM refs ---
const tabListEl = document.getElementById("tab-list");
const terminalContainer = document.getElementById("terminal-container");
const newTabBtn = document.getElementById("new-tab-btn");
const pickerOverlay = document.getElementById("picker-overlay");
const pickerSearch = document.getElementById("picker-search");
const pickerList = document.getElementById("picker-list");
const sidebarEl = document.getElementById("sidebar");
const resizeHandle = document.getElementById("sidebar-resize-handle");
const emptyStateEl = document.getElementById("empty-state");
const topbarPathEl = document.getElementById("topbar-path");
const topbarNameEl = document.getElementById("topbar-name");
const topbarNewTabBtn = document.getElementById("topbar-new-tab");
const emptyStateOpenBtn = document.getElementById("empty-state-open-btn");
const emptyStateRecents = document.getElementById("empty-state-recents");
const followIndicator = document.getElementById("follow-indicator");
const peekPanel = document.getElementById("peek-panel");
const peekTabName = document.getElementById("peek-tab-name");
const peekTabStatus = document.getElementById("peek-tab-status");
const peekContent = document.getElementById("peek-content");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsCloseBtn = document.getElementById("settings-close");
const settingsWorkspaceDir = document.getElementById("settings-workspace-dir");
const settingsBrowseBtn = document.getElementById("settings-browse-btn");
const settingsThemeSelect = document.getElementById("settings-theme");
const settingsFontFamily = document.getElementById("settings-font-family");
const settingsFontSize = document.getElementById("settings-font-size");
const settingsOpenThemes = document.getElementById("settings-open-themes");

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

const MAX_BUFFER_LINES = 20;

function refitActiveTerminal() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.fitAddon.fit();
  electronAPI.resizePty(tab.id, tab.terminal.cols, tab.terminal.rows);
}

function basename(dir) {
  return dir.split("/").pop() || dir;
}

function getDisplayName(tab) {
  if (tab.customName) return tab.customName;
  const base = basename(tab.directory);
  const sameNameTabs = tabs.filter(
    (t) => !t.customName && basename(t.directory) === base,
  );
  if (sameNameTabs.length <= 1) return base;
  const index = sameNameTabs.indexOf(tab);
  return index === 0 ? base : `${base} (${index + 1})`;
}

// ===========================
// UI State Updates
// ===========================

function updateTopbar() {
  const tab = getActiveTab();
  topbarPathEl.textContent = tab ? tab.directory.replace(homePath, "~") : "";
  topbarNameEl.textContent = tab ? getDisplayName(tab) : "";

  // Warning/exited states
  topbarPathEl.classList.remove("topbar-exited", "topbar-warning");
  topbarNameEl.classList.remove("topbar-exited", "topbar-warning");
  if (tab && tab.exited) {
    topbarPathEl.classList.add("topbar-exited");
    topbarNameEl.classList.add("topbar-exited");
  } else if (tab && tab._originalDir) {
    topbarPathEl.classList.add("topbar-warning");
    topbarNameEl.classList.add("topbar-warning");
  }

  // Tab position counter
  const topbarCounterElement = document.getElementById("topbar-counter");
  if (tab && tabs.length > 1) {
    const pos = tabs.indexOf(tab) + 1;
    topbarCounterElement.textContent = `${pos} / ${tabs.length}`;
  } else {
    topbarCounterElement.textContent = "";
  }
}

async function updateEmptyState() {
  if (tabs.length === 0) {
    emptyStateEl.classList.remove("hidden");
    terminalContainer.classList.add("hidden");
    await renderEmptyStateRecents();
  } else {
    emptyStateEl.classList.add("hidden");
    terminalContainer.classList.remove("hidden");
  }
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

    item.addEventListener("click", () => createTab(r.path));
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
      (tab.exited ? " tab-exited" : "");
    el.dataset.tabId = tab.id;
    el.draggable = true;

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
    closeBtn.className = "close-btn nf-icon";
    closeBtn.textContent = "\udb80\udd56";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(closeBtn);

    el.addEventListener("click", () => switchTab(tab.id));

    // Hover peek (only for non-active tabs)
    el.addEventListener("mouseenter", () => {
      if (tab.id === activeTabId) return;
      clearTimeout(peekTimeout);
      peekTimeout = setTimeout(() => showPeek(tab, el), 500);
    });
    el.addEventListener("mouseleave", () => {
      if (peekTabId !== tab.id) {
        clearTimeout(peekTimeout);
        peekTimeout = null;
      } else {
        // Delay hiding to allow mouse to move to peek panel
        clearTimeout(peekTimeout);
        peekTimeout = setTimeout(() => hidePeek(), 200);
      }
    });

    nameSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      if (tab.id !== activeTabId) switchTab(tab.id);
    });

    nameSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      e.preventDefault();
      startRename(tab, nameSpan);
    });

    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", tab.id);
      el.classList.add("dragging");
    });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("drag-over");
      reorderTabs(e.dataTransfer.getData("text/plain"), tab.id);
    });

    tabListEl.appendChild(el);
  }
}

// ===========================
// Hover Peek
// ===========================

let peekTimeout = null;
let peekTabId = null;

function showPeek(tab, tabEl) {
  peekTabId = tab.id;
  peekTabName.textContent = getDisplayName(tab);

  if (tab.exited) {
    peekTabStatus.textContent = "exited";
    peekTabStatus.style.color = "#585b70";
  } else {
    peekTabStatus.textContent = "idle";
    peekTabStatus.style.color = "#6c7086";
  }

  // Read from xterm.js terminal buffer (already processes all escape sequences)
  const buffer = tab.terminal.buffer.active;
  const lines = [];
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (line) lines.push(line.translateToString(true).trimEnd());
  }
  // Strip Claude Code TUI chrome (prompt box + statusbar) and trailing empties
  const cleaned = stripTuiChrome(lines);
  const text = cleaned.slice(-MAX_BUFFER_LINES).join("\n").trim();
  peekContent.textContent = text || "(no output yet)";
  peekContent.scrollTop = peekContent.scrollHeight;

  // Position to the right of the sidebar, aligned with the tab
  const rect = tabEl.getBoundingClientRect();
  const sidebarRect = sidebarEl.getBoundingClientRect();
  peekPanel.style.left = `${sidebarRect.right + 8}px`;
  peekPanel.style.top = `${Math.max(rect.top, 40)}px`;
  peekPanel.classList.remove("hidden");
}

function hidePeek() {
  clearTimeout(peekTimeout);
  peekTimeout = null;
  peekTabId = null;
  peekPanel.classList.add("hidden");
}

peekPanel.addEventListener("mouseenter", () => {
  clearTimeout(peekTimeout);
});

peekPanel.addEventListener("mouseleave", () => {
  hidePeek();
});

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

function createTab(directory, customName = null, originalDir = null) {
  const id = crypto.randomUUID();
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

  electronAPI.spawnPty(id, directory);
  electronAPI.trackWorkspace(directory);
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
  hidePeek();
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
  electronAPI.spawnPty(tab.id, tab.directory);
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
  input.focus();
  input.select();

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
// Drag Reorder
// ===========================

function reorderTabs(fromId, toId) {
  if (fromId === toId) return;
  const fromIndex = tabs.findIndex((t) => t.id === fromId);
  const toIndex = tabs.findIndex((t) => t.id === toId);
  const [moved] = tabs.splice(fromIndex, 1);
  tabs.splice(toIndex, 0, moved);
  renderSidebar();
  scheduleSave();
}

// ===========================
// Directory Picker
// ===========================

let pickerDirs = [];
let pickerSelectedIndex = 0;

async function openPicker() {
  const [workspaceDirs, recentWorkspaces] = await Promise.all([
    electronAPI.listWorkspaceDirs(),
    electronAPI.getRecentWorkspaces(),
  ]);

  const recentPaths = new Set();
  const recentItems = [];
  for (const r of recentWorkspaces.slice(0, 5)) {
    recentItems.push({ name: basename(r.path), path: r.path, isRecent: true });
    recentPaths.add(r.path);
  }

  const allItems = workspaceDirs
    .filter((d) => !recentPaths.has(d.path))
    .map((d) => ({ name: d.name, path: d.path }));

  pickerDirs = [
    ...recentItems,
    ...(recentItems.length > 0
      ? [{ name: "---", path: null, isSeparator: true }]
      : []),
    { name: "~ (Home)", path: homePath, isHome: true },
    ...allItems,
    { name: "Browse...", path: null, isBrowse: true },
  ];

  pickerSearch.value = "";
  pickerSelectedIndex = 0;
  renderPickerList("");
  pickerOverlay.classList.remove("hidden");
  pickerSearch.focus();
}

function closePicker() {
  pickerOverlay.classList.add("hidden");
  const footer = document.getElementById("picker-browse-footer");
  if (footer) footer.remove();
  updateEmptyState();
  const tab = getActiveTab();
  if (tab) tab.terminal.focus();
}

function getFilteredDirs(filter) {
  if (!filter) return pickerDirs;
  const seen = new Set();
  const scored = [];
  const browseItem = pickerDirs.find((d) => d.isBrowse);
  for (const d of pickerDirs) {
    if (d.isSeparator || d.isBrowse) continue;
    if (!fuzzyMatch(d.name, filter)) continue;
    if (d.path && seen.has(d.path)) continue;
    if (d.path) seen.add(d.path);
    scored.push({ dir: d, score: fuzzyScore(d.name, filter) });
  }
  scored.sort((a, b) => b.score - a.score);
  const result = scored.map((s) => s.dir);
  if (browseItem) result.push(browseItem);
  return result;
}

function updatePickerSelection() {
  let idx = 0;
  pickerList.querySelectorAll("li").forEach((li) => {
    if (
      li.classList.contains("picker-separator") ||
      li.classList.contains("picker-section-header")
    )
      return;
    li.classList.toggle("selected", idx === pickerSelectedIndex);
    idx++;
  });
  // Update sticky Browse... footer selection
  const footer = document.getElementById("picker-browse-footer");
  if (footer) {
    footer.classList.toggle("selected", idx === pickerSelectedIndex);
  }
}

function renderPickerList(filter) {
  const filtered = getFilteredDirs(filter);
  pickerList.innerHTML = "";

  // Remove existing sticky footer if any
  const existingFooter = document.getElementById("picker-browse-footer");
  if (existingFooter) existingFooter.remove();

  // Separate Browse... from the rest
  const browseItem = filtered.find((d) => d.isBrowse);
  const listItems = filtered.filter((d) => !d.isBrowse);

  const selectableCount =
    listItems.filter((d) => !d.isSeparator).length + (browseItem ? 1 : 0);
  if (pickerSelectedIndex >= selectableCount)
    pickerSelectedIndex = Math.max(0, selectableCount - 1);

  let inRecents = true;
  let headerShown = false;
  let allHeaderShown = false;
  let selectableIndex = 0;
  listItems.forEach((dir) => {
    if (dir.isSeparator) {
      inRecents = false;
      return;
    }

    // Section headers (only when not filtering)
    if (!filter) {
      if (inRecents && dir.isRecent && !headerShown) {
        headerShown = true;
        const header = document.createElement("li");
        header.className = "picker-section-header";
        header.textContent = "Recent";
        pickerList.appendChild(header);
      }
      if (!inRecents && !dir.isBrowse && !dir.isHome && !allHeaderShown) {
        allHeaderShown = true;
        const header = document.createElement("li");
        header.className = "picker-section-header";
        header.textContent = "All Workspaces";
        pickerList.appendChild(header);
      }
    }

    const idx = selectableIndex++;
    const li = document.createElement("li");
    if (dir.isRecent) li.classList.add("picker-recent");
    li.classList.toggle("selected", idx === pickerSelectedIndex);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = dir.name;
    li.appendChild(nameSpan);

    if (dir.path && !dir.isHome && !dir.isBrowse) {
      const pathSpan = document.createElement("span");
      pathSpan.className = "picker-path";
      pathSpan.textContent = dir.path.replace(homePath, "~");
      li.appendChild(pathSpan);
    }

    li.addEventListener("click", () => selectPickerItem(dir));
    li.addEventListener("mouseenter", () => {
      pickerSelectedIndex = idx;
      updatePickerSelection();
    });
    pickerList.appendChild(li);
  });

  // Render Browse... as sticky footer
  if (browseItem) {
    const browseIdx = selectableIndex++;
    const footer = document.createElement("div");
    footer.id = "picker-browse-footer";
    footer.className = browseIdx === pickerSelectedIndex ? "selected" : "";
    footer.textContent = "Browse\u2026";
    footer.addEventListener("click", () => selectPickerItem(browseItem));
    footer.addEventListener("mouseenter", () => {
      pickerSelectedIndex = browseIdx;
      updatePickerSelection();
    });
    const pickerModal = document.getElementById("picker-modal");
    pickerModal.appendChild(footer);
  }
}

async function selectPickerItem(dir) {
  closePicker();
  let directory;
  if (dir.isBrowse) {
    directory = await electronAPI.openDirectoryDialog();
    if (!directory) return;
  } else {
    directory = dir.path;
  }
  createTab(directory);
}

pickerSearch.addEventListener("input", () => {
  pickerSelectedIndex = 0;
  renderPickerList(pickerSearch.value);
});

pickerSearch.addEventListener("keydown", (e) => {
  const selectable = getFilteredDirs(pickerSearch.value).filter(
    (d) => !d.isSeparator,
  );
  if (e.key === "ArrowDown") {
    e.preventDefault();
    pickerSelectedIndex = Math.min(
      pickerSelectedIndex + 1,
      selectable.length - 1,
    );
    updatePickerSelection();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    pickerSelectedIndex = Math.max(pickerSelectedIndex - 1, 0);
    updatePickerSelection();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (selectable[pickerSelectedIndex]) {
      selectPickerItem(selectable[pickerSelectedIndex]);
    }
  } else if (e.key === "Tab") {
    e.preventDefault();
    if (selectable[pickerSelectedIndex]) {
      pickerSearch.value = selectable[pickerSelectedIndex].name;
      pickerSelectedIndex = 0;
      renderPickerList(pickerSearch.value);
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    closePicker();
  }
});

pickerOverlay.addEventListener("click", (e) => {
  if (e.target === pickerOverlay) closePicker();
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
  // Strip ED3 when paired with ED2 (the TUI repaint pattern \x1b[2J\x1b[3J).
  // Claude's TUI sends this combo during streaming repaints, and the ED3 resets
  // xterm's viewportY to 0 (scrolls to top). Standalone ED3 (e.g. from `clear`)
  // is preserved.
  const ESC = "\x1b";
  const ED2_ED3 = new RegExp(ESC + "\\[2J" + ESC + "\\[3J", "g");
  const filtered = data.replace(ED2_ED3, ESC + "[2J");
  tab.terminal.write(filtered);
});

electronAPI.onPtyExit((tabId, _exitCode) => {
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

electronAPI.onNewTab(() => openPicker());
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

newTabBtn.addEventListener("click", openPicker);
topbarNewTabBtn.addEventListener("click", openPicker);
emptyStateOpenBtn.addEventListener("click", openPicker);

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
  document.documentElement.style.setProperty(
    "--terminal-font",
    currentFontFamily,
  );
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

async function openSettings() {
  const settings = await electronAPI.loadSettings();
  settingsWorkspaceDir.value = settings.workspaceDir || "";

  // Populate theme dropdown
  const customThemes = await electronAPI.listCustomThemes();
  settingsThemeSelect.innerHTML = "";
  for (const theme of builtinThemes) {
    const opt = document.createElement("option");
    opt.value = theme.name;
    opt.textContent = theme.name;
    settingsThemeSelect.appendChild(opt);
  }
  if (customThemes.length > 0) {
    const sep = document.createElement("option");
    sep.disabled = true;
    sep.textContent = "--- Custom ---";
    settingsThemeSelect.appendChild(sep);
    for (const theme of customThemes) {
      const opt = document.createElement("option");
      opt.value = theme.name;
      opt.textContent = theme.name;
      settingsThemeSelect.appendChild(opt);
    }
  }
  settingsThemeSelect.value = settings.theme || DEFAULT_THEME_NAME;

  // Font settings
  settingsFontFamily.value = settings.fontFamily || currentFontFamily;
  settingsFontSize.value = settings.fontSize || currentFontSize;

  settingsOverlay.classList.remove("hidden");
  settingsThemeSelect.focus();
}

function closeSettings() {
  settingsOverlay.classList.add("hidden");
  const tab = getActiveTab();
  if (tab) tab.terminal.focus();
}

async function saveSettingsValue(key, value) {
  await electronAPI.saveSettings({ [key]: value });
}

settingsCloseBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettings();
});

settingsWorkspaceDir.addEventListener("change", () => {
  saveSettingsValue("workspaceDir", settingsWorkspaceDir.value);
});

settingsBrowseBtn.addEventListener("click", async () => {
  const dir = await electronAPI.openDirectoryDialog();
  if (dir) {
    settingsWorkspaceDir.value = dir;
    saveSettingsValue("workspaceDir", dir);
  }
});

settingsThemeSelect.addEventListener("change", async () => {
  const name = settingsThemeSelect.value;
  const customThemes = await electronAPI.listCustomThemes();
  const theme = getThemeByName(name, customThemes);
  applyThemeToAllTerminals(theme);
  saveSettingsValue("theme", name);
});

settingsFontFamily.addEventListener("change", () => {
  currentFontFamily = settingsFontFamily.value;
  applyFontToAllTerminals();
  saveSettingsValue("fontFamily", currentFontFamily);
});

settingsFontSize.addEventListener("change", () => {
  const size = parseInt(settingsFontSize.value, 10);
  if (size >= 8 && size <= 32) {
    currentFontSize = size;
    applyFontToAllTerminals();
    saveSettingsValue("fontSize", size);
  }
});

settingsOpenThemes.addEventListener("click", () => {
  electronAPI.openThemesFolder();
});

electronAPI.onOpenSettings(() => openSettings());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsOverlay.classList.contains("hidden")) {
    e.preventDefault();
    closeSettings();
    return;
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
  updateEmptyState();

  // Load theme and font settings on startup
  const startupSettings = await electronAPI.loadSettings();
  currentFontFamily = startupSettings.fontFamily || currentFontFamily;
  currentFontSize = startupSettings.fontSize || currentFontSize;
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

  if (!data.tabs || data.tabs.length === 0) {
    openPicker();
  } else {
    for (const tabData of data.tabs) {
      createTab(
        tabData.directory,
        tabData.customName,
        tabData._originalDir || null,
      );
    }
    if (data.activeTabIndex >= 0 && data.activeTabIndex < tabs.length) {
      switchTab(tabs[data.activeTabIndex].id);
    }
    setTimeout(() => refitActiveTerminal(), 200);
  }
}

init();
