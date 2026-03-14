import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { terminalTheme } from "./theme.js";

const { electronAPI } = window;

// --- State ---
let tabs = []; // [{ id, directory, customName, terminal, fitAddon, wrapper, exited, _originalDir }]
let activeTabId = null;
let sidebarWidth = 200;
let saveTimeout = null;
let homePath = "";

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
const topbarNewTabBtn = document.getElementById("topbar-new-tab");
const emptyStateOpenBtn = document.getElementById("empty-state-open-btn");

// ===========================
// Helpers
// ===========================

function getActiveTab() {
  return tabs.find((t) => t.id === activeTabId);
}

function refitActiveTerminal() {
  const tab = getActiveTab();
  if (!tab) return;
  const buf = tab.terminal.buffer.active;
  const wasAtBottom = buf.viewportY >= buf.baseY;
  const savedViewportY = buf.viewportY;
  tab.fitAddon.fit();
  if (wasAtBottom) {
    tab.terminal.scrollToBottom();
  } else {
    // Restore approximate scroll position after reflow
    tab.terminal.scrollToLine(
      Math.min(savedViewportY, tab.terminal.buffer.active.baseY),
    );
  }
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
  topbarPathEl.textContent = tab ? tab.directory : "";
}

function updateEmptyState() {
  if (tabs.length === 0) {
    emptyStateEl.classList.remove("hidden");
    terminalContainer.classList.add("hidden");
  } else {
    emptyStateEl.classList.add("hidden");
    terminalContainer.classList.remove("hidden");
  }
}

// ===========================
// Sidebar Rendering
// ===========================

function renderSidebar() {
  tabListEl.innerHTML = "";
  for (const tab of tabs) {
    const el = document.createElement("div");
    el.className = "tab-entry" + (tab.id === activeTabId ? " active" : "");
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
    closeBtn.className = "close-btn";
    closeBtn.textContent = "\u00d7";
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
    theme: terminalTheme,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 14,
    scrollback: 5000,
    cursorBlink: true,
    allowProposedApi: true,
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

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
          refitActiveTerminal();
          tab.terminal.focus();
        });
      });
    }
  }
  renderSidebar();
  updateTopbar();
}

async function closeTab(tabId) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;

  if (tabs.length === 1) {
    if (!confirm("Close the last tab and quit?")) return;
    destroyTab(tab);
    await saveSessionsNow();
    window.close();
    return;
  }

  const index = tabs.indexOf(tab);
  destroyTab(tab);
  updateEmptyState();

  if (tabs.length === 0) {
    activeTabId = null;
    renderSidebar();
    updateTopbar();
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
  updateEmptyState();
  const tab = getActiveTab();
  if (tab) tab.terminal.focus();
}

function getFilteredDirs(filter) {
  if (!filter) return pickerDirs;
  const lf = filter.toLowerCase();
  const seen = new Set();
  return pickerDirs.filter((d) => {
    if (d.isSeparator) return false;
    if (!d.name.toLowerCase().includes(lf)) return false;
    if (d.path && seen.has(d.path)) return false;
    if (d.path) seen.add(d.path);
    return true;
  });
}

function updatePickerSelection() {
  let idx = 0;
  pickerList.querySelectorAll("li").forEach((li) => {
    if (li.classList.contains("picker-separator")) return;
    li.classList.toggle("selected", idx === pickerSelectedIndex);
    idx++;
  });
}

function renderPickerList(filter) {
  const filtered = getFilteredDirs(filter);
  pickerList.innerHTML = "";

  const selectableCount = filtered.filter((d) => !d.isSeparator).length;
  if (pickerSelectedIndex >= selectableCount)
    pickerSelectedIndex = Math.max(0, selectableCount - 1);

  let selectableIndex = 0;
  filtered.forEach((dir) => {
    if (dir.isSeparator) {
      const li = document.createElement("li");
      li.className = "picker-separator";
      pickerList.appendChild(li);
      return;
    }

    const idx = selectableIndex++;
    const li = document.createElement("li");
    li.textContent = dir.name;
    if (dir.isRecent) li.classList.add("picker-recent");
    li.classList.toggle("selected", idx === pickerSelectedIndex);
    li.addEventListener("click", () => selectPickerItem(dir));
    li.addEventListener("mouseenter", () => {
      pickerSelectedIndex = idx;
      updatePickerSelection();
    });
    pickerList.appendChild(li);
  });
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
    renderPickerList(pickerSearch.value);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    pickerSelectedIndex = Math.max(pickerSelectedIndex - 1, 0);
    renderPickerList(pickerSearch.value);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (selectable[pickerSelectedIndex]) {
      selectPickerItem(selectable[pickerSelectedIndex]);
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
  if (tab) tab.terminal.write(data);
});

electronAPI.onPtyExit((tabId, _exitCode) => {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.exited = true;
    tab.terminal.writeln("");
    tab.terminal.writeln(
      "\x1b[33m[Session ended. Press Enter to restart or Cmd+W to close]\x1b[0m",
    );
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
  refitActiveTerminal();
});

document.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    resizeHandle.classList.remove("active");
    document.body.style.cursor = "";
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

newTabBtn.addEventListener("click", openPicker);
topbarNewTabBtn.addEventListener("click", openPicker);
emptyStateOpenBtn.addEventListener("click", openPicker);

// ===========================
// CWD Tracking
// ===========================

setInterval(async () => {
  for (const tab of tabs) {
    if (tab.exited) continue;
    const cwd = await electronAPI.getPtyCwd(tab.id);
    if (cwd && cwd !== tab.directory) {
      tab.directory = cwd;
      renderSidebar();
      if (tab.id === activeTabId) updateTopbar();
      scheduleSave();
    }
  }
}, 3000);

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
