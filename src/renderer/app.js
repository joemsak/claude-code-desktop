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

// ===========================
// Tab Display Name
// ===========================

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

    // Instant tooltip with directory path (or warning for missing dirs)
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

    nameSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startRename(tab, nameSpan);
    });

    // Drag events
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
      const fromId = e.dataTransfer.getData("text/plain");
      reorderTabs(fromId, tab.id);
    });

    tabListEl.appendChild(el);
  }
}

// ===========================
// Tab Lifecycle
// ===========================

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
      if (data === "\r") {
        restartTab(tab);
      }
      return;
    }
    electronAPI.writePty(id, data);
  });

  electronAPI.spawnPty(id, directory);
  switchTab(id);
  scheduleSave();
  return tab;
}

function switchTab(tabId) {
  activeTabId = tabId;
  for (const tab of tabs) {
    const isActive = tab.id === tabId;
    tab.wrapper.classList.toggle("active", isActive);
    if (isActive) {
      // Small delay to let the DOM render before fitting
      requestAnimationFrame(() => {
        tab.fitAddon.fit();
        electronAPI.resizePty(tab.id, tab.terminal.cols, tab.terminal.rows);
        tab.terminal.focus();
      });
    }
  }
  renderSidebar();
}

function closeTab(tabId) {
  if (tabs.length === 1) {
    if (!confirm("Close the last tab and quit?")) return;
    saveSessionsNow();
    window.close();
    return;
  }

  const index = tabs.findIndex((t) => t.id === tabId);
  const tab = tabs[index];
  electronAPI.killPty(tabId);
  tab.terminal.dispose();
  tab.wrapper.remove();
  tabs.splice(index, 1);

  if (activeTabId === tabId) {
    const newIndex = Math.min(index, tabs.length - 1);
    switchTab(tabs[newIndex].id);
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
  const workspaceDirs = await electronAPI.listWorkspaceDirs();
  pickerDirs = [
    { name: "~ (Home)", path: homePath, isHome: true },
    ...workspaceDirs.map((d) => ({ name: d.name, path: d.path })),
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
  // Refocus active terminal
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (activeTab) activeTab.terminal.focus();
}

function getFilteredDirs(filter) {
  return pickerDirs.filter((d) =>
    d.name.toLowerCase().includes(filter.toLowerCase()),
  );
}

function updatePickerSelection() {
  const items = pickerList.querySelectorAll("li");
  items.forEach((li, i) =>
    li.classList.toggle("selected", i === pickerSelectedIndex),
  );
}

function renderPickerList(filter) {
  const filtered = getFilteredDirs(filter);
  pickerList.innerHTML = "";
  // Clamp selected index
  if (pickerSelectedIndex >= filtered.length)
    pickerSelectedIndex = Math.max(0, filtered.length - 1);

  filtered.forEach((dir, i) => {
    const li = document.createElement("li");
    li.textContent = dir.name;
    li.classList.toggle("selected", i === pickerSelectedIndex);
    li.addEventListener("click", () => selectPickerItem(dir));
    li.addEventListener("mouseenter", () => {
      pickerSelectedIndex = i;
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
  const filtered = getFilteredDirs(pickerSearch.value);
  if (e.key === "ArrowDown") {
    e.preventDefault();
    pickerSelectedIndex = Math.min(
      pickerSelectedIndex + 1,
      filtered.length - 1,
    );
    renderPickerList(pickerSearch.value);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    pickerSelectedIndex = Math.max(pickerSelectedIndex - 1, 0);
    renderPickerList(pickerSearch.value);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (filtered[pickerSelectedIndex]) {
      selectPickerItem(filtered[pickerSelectedIndex]);
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
  const sessionData = {
    version: 1,
    window: bounds || { width: 1200, height: 800 },
    sidebarWidth,
    tabs: tabs.map((t) => ({
      directory: t.directory,
      customName: t.customName,
    })),
    activeTabIndex: tabs.findIndex((t) => t.id === activeTabId),
  };
  electronAPI.saveSessions(sessionData);
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
// Menu Events from Main
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
  const newWidth = Math.min(400, Math.max(120, e.clientX));
  sidebarWidth = newWidth;
  sidebarEl.style.width = `${newWidth}px`;
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (activeTab) {
    activeTab.fitAddon.fit();
    electronAPI.resizePty(
      activeTab.id,
      activeTab.terminal.cols,
      activeTab.terminal.rows,
    );
  }
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
  // Cmd+1-9: switch to tab N
  if (e.metaKey && !e.shiftKey && e.key >= "1" && e.key <= "9") {
    e.preventDefault();
    const index = parseInt(e.key) - 1;
    if (tabs[index]) switchTab(tabs[index].id);
    return;
  }
  // Cmd+Shift+[: previous tab
  if (e.metaKey && e.shiftKey && e.key === "[") {
    e.preventDefault();
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    if (currentIndex > 0) switchTab(tabs[currentIndex - 1].id);
    return;
  }
  // Cmd+Shift+]: next tab
  if (e.metaKey && e.shiftKey && e.key === "]") {
    e.preventDefault();
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    if (currentIndex < tabs.length - 1) switchTab(tabs[currentIndex + 1].id);
    return;
  }
});

// Resize terminal on window resize
window.addEventListener("resize", () => {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (activeTab) {
    activeTab.fitAddon.fit();
    electronAPI.resizePty(
      activeTab.id,
      activeTab.terminal.cols,
      activeTab.terminal.rows,
    );
  }
});

// New tab button
newTabBtn.addEventListener("click", openPicker);

// ===========================
// Initialization
// ===========================

async function init() {
  homePath = await electronAPI.getHomePath();
  const sessionData = await electronAPI.loadSessions();
  const data = sessionData || {
    tabs: [{ directory: homePath, customName: null }],
    activeTabIndex: 0,
    sidebarWidth: 200,
  };

  sidebarWidth = data.sidebarWidth || 200;
  sidebarEl.style.width = `${sidebarWidth}px`;

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
}

init();
