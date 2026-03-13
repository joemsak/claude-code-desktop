# Claude Code Desktop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron desktop app that manages multiple Claude Code terminal sessions with persistent named tabs, a left sidebar, directory picker, and session restore.

**Architecture:** Electron main process manages PTY instances (node-pty) and session state. Renderer process uses xterm.js for terminal emulation and vanilla HTML/CSS for the tab sidebar and directory picker. Communication via contextBridge IPC. esbuild bundles the renderer since xterm.js is ESM.

**Tech Stack:** Electron, xterm.js, node-pty, esbuild, @electron/rebuild, electron-builder

**Spec:** `docs/superpowers/specs/2026-03-13-claude-code-desktop-design.md`

---

## File Structure

```
claude-code-desktop/
  package.json              # Dependencies, scripts (start, build, bundle-renderer)
  esbuild.config.js         # esbuild config for bundling renderer
  src/
    main/
      main.js               # Electron app lifecycle, BrowserWindow, IPC handlers, menu
      pty-manager.js         # PTY spawn/write/resize/kill, event forwarding
      session-store.js       # Read/write ~/.config/claude-code-desktop/sessions.json
    preload/
      preload.js             # contextBridge electronAPI
    renderer/
      index.html             # App shell (sidebar + terminal container)
      styles.css             # All styles (sidebar, terminal, directory picker, theme)
      app.js                 # Entry point: tab state, terminal lifecycle, UI events
      theme.js               # Color constants for xterm.js and app chrome
```

---

## Chunk 1: Project Scaffolding and Core PTY Pipeline

### Task 1: Initialize project and install dependencies

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize npm project**

```bash
cd /Users/joseph.sak/workspace/claude-code-desktop
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install electron@latest xterm @xterm/addon-fit node-pty
npm install --save-dev esbuild @electron/rebuild electron-builder
```

- [ ] **Step 3: Configure package.json**

Set `"main": "src/main/main.js"` and add scripts:

```json
{
  "main": "src/main/main.js",
  "scripts": {
    "start": "npm run rebuild && npm run bundle && electron .",
    "bundle": "node esbuild.config.js",
    "rebuild": "electron-rebuild -f -w node-pty",
    "dist": "npm run bundle && electron-builder"
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
out/
src/renderer/bundle.js
```

- [ ] **Step 5: Create esbuild config**

Create `esbuild.config.js`:

```js
const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: ['src/renderer/app.js'],
  bundle: true,
  outfile: 'src/renderer/bundle.js',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
});
```

- [ ] **Step 6: Rebuild node-pty for Electron**

```bash
npm run rebuild
```

Expected: Completes without errors. node-pty native module compiled against Electron's Node version.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore esbuild.config.js
git commit -m "chore: initialize project with Electron, xterm.js, node-pty"
```

---

### Task 2: Theme constants

**Files:**
- Create: `src/renderer/theme.js`

- [ ] **Step 1: Create theme.js with Dusk color scheme**

```js
// Dusk theme — inspired by Catppuccin Mocha, One Dark Pro, Tokyo Night
export const terminalTheme = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#45475a',
  selectionForeground: '#cdd6f4',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#cba6f7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#cba6f7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/theme.js
git commit -m "feat: add Dusk terminal color theme"
```

---

### Task 3: Session store (main process)

**Files:**
- Create: `src/main/session-store.js`

- [ ] **Step 1: Implement session-store.js**

```js
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'claude-code-desktop');
const SESSION_FILE = path.join(CONFIG_DIR, 'sessions.json');

const DEFAULT_SESSION = {
  version: 1,
  window: { x: undefined, y: undefined, width: 1200, height: 800 },
  sidebarWidth: 200,
  tabs: [{ directory: os.homedir(), customName: null }],
  activeTabIndex: 0,
};

function load() {
  try {
    const data = fs.readFileSync(SESSION_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
      // Validate directories — fall back to home if missing
      parsed.tabs = parsed.tabs.map((tab) => {
        if (!fs.existsSync(tab.directory)) {
          return { ...tab, directory: os.homedir() };
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
    console.error('Failed to save session:', err.message);
  }
}

module.exports = { load, save, DEFAULT_SESSION };
```

- [ ] **Step 2: Commit**

```bash
git add src/main/session-store.js
git commit -m "feat: add session store for persist/restore"
```

---

### Task 4: PTY manager (main process)

**Files:**
- Create: `src/main/pty-manager.js`

- [ ] **Step 1: Implement pty-manager.js**

```js
const pty = require('node-pty');
const os = require('os');

// Map of tabId -> pty instance
const ptys = new Map();

function spawn(tabId, directory, onData, onExit) {
  const shell = process.env.SHELL || '/bin/zsh';
  const ptyProcess = pty.spawn(shell, ['-l', '-c', 'claude'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: directory,
    env: { ...process.env, HOME: os.homedir() },
  });

  ptyProcess.onData((data) => onData(tabId, data));
  ptyProcess.onExit(({ exitCode }) => {
    ptys.delete(tabId);
    onExit(tabId, exitCode);
  });

  ptys.set(tabId, { process: ptyProcess, directory });
  return ptyProcess;
}

function write(tabId, data) {
  const entry = ptys.get(tabId);
  if (entry) entry.process.write(data);
}

function resize(tabId, cols, rows) {
  const entry = ptys.get(tabId);
  if (entry) entry.process.resize(cols, rows);
}

function kill(tabId) {
  const entry = ptys.get(tabId);
  if (entry) {
    entry.process.kill();
    ptys.delete(tabId);
  }
}

function killAll() {
  for (const [tabId, entry] of ptys) {
    entry.process.kill();
  }
  ptys.clear();
}

function getDirectory(tabId) {
  const entry = ptys.get(tabId);
  return entry ? entry.directory : null;
}

module.exports = { spawn, write, resize, kill, killAll, getDirectory };
```

- [ ] **Step 2: Commit**

```bash
git add src/main/pty-manager.js
git commit -m "feat: add PTY manager for spawning claude sessions"
```

---

### Task 5: Preload script

**Files:**
- Create: `src/preload/preload.js`

- [ ] **Step 1: Implement preload.js**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // PTY management
  spawnPty: (tabId, directory) => ipcRenderer.send('pty:spawn', tabId, directory),
  writePty: (tabId, data) => ipcRenderer.send('pty:write', tabId, data),
  resizePty: (tabId, cols, rows) => ipcRenderer.send('pty:resize', tabId, cols, rows),
  killPty: (tabId) => ipcRenderer.send('pty:kill', tabId),

  // PTY events (main -> renderer)
  onPtyData: (callback) => ipcRenderer.on('pty:data', (_event, tabId, data) => callback(tabId, data)),
  onPtyExit: (callback) => ipcRenderer.on('pty:exit', (_event, tabId, exitCode) => callback(tabId, exitCode)),

  // Session persistence
  saveSessions: (sessionData) => ipcRenderer.invoke('sessions:save', sessionData),
  loadSessions: () => ipcRenderer.invoke('sessions:load'),

  // Directory picker
  listWorkspaceDirs: () => ipcRenderer.invoke('dirs:list-workspace'),
  openDirectoryDialog: () => ipcRenderer.invoke('dirs:open-dialog'),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/preload.js
git commit -m "feat: add preload script with electronAPI bridge"
```

---

### Task 6: Main process — Electron app, IPC handlers, window management

**Files:**
- Create: `src/main/main.js`

- [ ] **Step 1: Implement main.js**

```js
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ptyManager = require('./pty-manager');
const sessionStore = require('./session-store');

let mainWindow;

function createWindow(sessionData) {
  const win = sessionData?.window || sessionStore.DEFAULT_SESSION.window;

  mainWindow = new BrowserWindow({
    x: win.x,
    y: win.y,
    width: win.width || 1200,
    height: win.height || 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#1e1e2e',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Send restored session data to renderer once ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('session:restored', sessionData);
  });
}

// IPC: PTY management
ipcMain.on('pty:spawn', (event, tabId, directory) => {
  ptyManager.spawn(
    tabId,
    directory,
    (id, data) => event.sender.send('pty:data', id, data),
    (id, exitCode) => event.sender.send('pty:exit', id, exitCode)
  );
});

ipcMain.on('pty:write', (_event, tabId, data) => {
  ptyManager.write(tabId, data);
});

ipcMain.on('pty:resize', (_event, tabId, cols, rows) => {
  ptyManager.resize(tabId, cols, rows);
});

ipcMain.on('pty:kill', (_event, tabId) => {
  ptyManager.kill(tabId);
});

// IPC: Session persistence
ipcMain.handle('sessions:save', (_event, sessionData) => {
  sessionStore.save(sessionData);
});

ipcMain.handle('sessions:load', () => {
  return sessionStore.load();
});

// IPC: Directory picker
ipcMain.handle('dirs:list-workspace', () => {
  const workspaceDir = path.join(os.homedir(), 'workspace');
  try {
    const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  } catch {
    return [];
  }
});

ipcMain.handle('dirs:open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: os.homedir(),
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// App lifecycle
app.whenReady().then(() => {
  const sessionData = sessionStore.load() || sessionStore.DEFAULT_SESSION;
  createWindow(sessionData);

  // Build minimal menu (needed for keyboard shortcuts to work)
  const template = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow.webContents.send('menu:new-tab'),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow.webContents.send('menu:close-tab'),
        },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});

app.on('window-all-closed', () => {
  ptyManager.killAll();
  app.quit();
});

app.on('before-quit', () => {
  ptyManager.killAll();
});
```

- [ ] **Step 2: Commit**

```bash
git add src/main/main.js
git commit -m "feat: add Electron main process with IPC handlers"
```

---

### Task 7: Minimal renderer — HTML shell and styles

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/styles.css`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'">
  <link rel="stylesheet" href="styles.css">
  <title>Claude Code Desktop</title>
</head>
<body>
  <div id="app">
    <aside id="sidebar">
      <div id="tab-list"></div>
      <button id="new-tab-btn" title="New Tab (Cmd+T)">+</button>
    </aside>
    <div id="sidebar-resize-handle"></div>
    <main id="terminal-container"></main>
  </div>

  <!-- Directory Picker Overlay -->
  <div id="picker-overlay" class="hidden">
    <div id="picker-modal">
      <input id="picker-search" type="text" placeholder="Search workspace..." autocomplete="off" spellcheck="false">
      <ul id="picker-list"></ul>
    </div>
  </div>

  <script src="bundle.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create styles.css**

Full stylesheet implementing the Dusk theme for sidebar, terminal container, directory picker, drag handle, tab entries with hover/active states, inline rename input, close buttons, scrollbar styling, and the directory picker modal. All colors from the spec's Color Theme section.

Key CSS details:
- `body`: margin 0, overflow hidden, background `#1e1e2e`, font-family `-apple-system`
- `#app`: display flex, height 100vh
- `#sidebar`: width from CSS variable (default 200px), min-width 120px, max-width 400px, background `#181825`, border-right `1px solid #313244`, display flex, flex-direction column
- `#tab-list`: flex 1, overflow-y auto
- `.tab-entry`: padding 8px 12px, cursor pointer, color `#6c7086`, position relative, white-space nowrap, overflow hidden, text-overflow ellipsis, font-size 13px
- `.tab-entry.active`: background `#313244`, color `#cdd6f4`
- `.tab-entry .close-btn`: hidden by default, shown on hover, position absolute right
- `#sidebar-resize-handle`: width 4px, cursor col-resize, background transparent, hover background `#45475a`
- `#terminal-container`: flex 1, position relative
- `.terminal-wrapper`: position absolute, inset 0, display none
- `.terminal-wrapper.active`: display block
- `#picker-overlay`: position fixed, inset 0, background `rgba(0,0,0,0.6)`, display flex, align-items center, justify-content center, z-index 100
- `#picker-modal`: width 400px, max-height 500px, background `#1e1e2e`, border-radius 8px, overflow hidden
- `#picker-search`: width 100%, background `#313244`, color `#cdd6f4`, border none, padding 12px, font-size 14px, outline none
- `#picker-list`: list-style none, margin 0, padding 0, max-height 440px, overflow-y auto
- `#picker-list li`: padding 10px 16px, color `#cdd6f4`, cursor pointer
- `#picker-list li.selected`: background `#45475a`
- `.hidden`: display none !important
- `#new-tab-btn`: background none, border none, color `#6c7086`, font-size 24px, padding 12px, cursor pointer, hover color `#cdd6f4`
- Drag-active tab: opacity 0.5
- Inline rename input: background `#313244`, color `#cdd6f4`, border 1px solid `#89b4fa`, font-size 13px, width 100%, padding 2px 4px

(Full CSS will be written in implementation — all values from the spec's color tables.)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/index.html src/renderer/styles.css
git commit -m "feat: add HTML shell and Dusk theme styles"
```

---

### Task 8: Renderer app.js — core tab and terminal management

**Files:**
- Create: `src/renderer/app.js`

This is the largest file. It manages:
1. Tab state (array of `{ id, directory, customName }`)
2. xterm.js Terminal instances (one per tab)
3. Sidebar rendering and interaction
4. Directory picker
5. Keyboard shortcuts
6. Session save/restore
7. Sidebar resize
8. Drag reorder
9. Inline rename

- [ ] **Step 1: Create app.js with imports and state**

```js
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { terminalTheme } from './theme.js';

const { electronAPI } = window;

// --- State ---
let tabs = [];           // [{ id, directory, customName, terminal, fitAddon, exited }]
let activeTabId = null;
let sidebarWidth = 200;
let saveTimeout = null;

// --- DOM refs ---
const tabListEl = document.getElementById('tab-list');
const terminalContainer = document.getElementById('terminal-container');
const newTabBtn = document.getElementById('new-tab-btn');
const pickerOverlay = document.getElementById('picker-overlay');
const pickerSearch = document.getElementById('picker-search');
const pickerList = document.getElementById('picker-list');
const sidebarEl = document.getElementById('sidebar');
const resizeHandle = document.getElementById('sidebar-resize-handle');
```

- [ ] **Step 2: Add tab display name computation**

```js
function getDisplayName(tab) {
  if (tab.customName) return tab.customName;
  const baseName = tab.directory.split('/').pop() || tab.directory;
  // Count other tabs with same baseName and no customName
  const sameNameTabs = tabs.filter(
    (t) => !t.customName && (t.directory.split('/').pop() || t.directory) === baseName
  );
  if (sameNameTabs.length <= 1) return baseName;
  const index = sameNameTabs.indexOf(tab);
  return index === 0 ? baseName : `${baseName} (${index + 1})`;
}
```

- [ ] **Step 3: Add sidebar rendering**

```js
function renderSidebar() {
  tabListEl.innerHTML = '';
  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab-entry' + (tab.id === activeTabId ? ' active' : '');
    el.dataset.tabId = tab.id;
    el.title = tab.directory;
    el.draggable = true;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-name';
    nameSpan.textContent = getDisplayName(tab);
    el.appendChild(nameSpan);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(closeBtn);

    // Click to switch
    el.addEventListener('click', () => switchTab(tab.id));

    // Double-click to rename
    nameSpan.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startRename(tab, nameSpan);
    });

    // Drag events
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', tab.id);
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const fromId = e.dataTransfer.getData('text/plain');
      reorderTabs(fromId, tab.id);
    });

    tabListEl.appendChild(el);
  }
}
```

- [ ] **Step 4: Add tab lifecycle functions (create, switch, close)**

```js
function createTab(directory, customName = null) {
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

  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-wrapper';
  wrapper.id = `terminal-${id}`;
  terminalContainer.appendChild(wrapper);
  terminal.open(wrapper);

  const tab = { id, directory, customName, terminal, fitAddon, wrapper, exited: false };
  tabs.push(tab);

  // Wire up input
  terminal.onData((data) => {
    if (tab.exited) {
      // Enter restarts, anything else ignored
      if (data === '\r') {
        restartTab(tab);
      }
      return;
    }
    electronAPI.writePty(id, data);
  });

  // Spawn PTY
  electronAPI.spawnPty(id, directory);

  switchTab(id);
  scheduleSave();
  return tab;
}

function switchTab(tabId) {
  activeTabId = tabId;
  for (const tab of tabs) {
    const isActive = tab.id === tabId;
    tab.wrapper.classList.toggle('active', isActive);
    if (isActive) {
      tab.fitAddon.fit();
      electronAPI.resizePty(tab.id, tab.terminal.cols, tab.terminal.rows);
      tab.terminal.focus();
    }
  }
  renderSidebar();
}

function closeTab(tabId) {
  if (tabs.length === 1) {
    // Last tab — confirm quit
    if (!confirm('Close the last tab and quit?')) return;
    saveSessionsSync();
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
```

- [ ] **Step 5: Add inline rename**

```js
function startRename(tab, nameSpan) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename-input';
  input.value = getDisplayName(tab);
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const finish = (save) => {
    if (save && input.value.trim()) {
      tab.customName = input.value.trim();
    }
    input.replaceWith(nameSpan);
    nameSpan.textContent = getDisplayName(tab);
    if (save) scheduleSave();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
    e.stopPropagation();
  });
  input.addEventListener('blur', () => finish(true));
}
```

- [ ] **Step 6: Add drag reorder**

```js
function reorderTabs(fromId, toId) {
  if (fromId === toId) return;
  const fromIndex = tabs.findIndex((t) => t.id === fromId);
  const toIndex = tabs.findIndex((t) => t.id === toId);
  const [moved] = tabs.splice(fromIndex, 1);
  tabs.splice(toIndex, 0, moved);
  renderSidebar();
  scheduleSave();
}
```

- [ ] **Step 7: Add directory picker**

```js
let pickerDirs = [];
let pickerSelectedIndex = 0;

async function openPicker() {
  const workspaceDirs = await electronAPI.listWorkspaceDirs();
  pickerDirs = [
    { name: '~ (Home)', path: null, isHome: true },
    ...workspaceDirs.map((name) => ({
      name,
      path: `${process.env.HOME || '/Users/' + require('os').userInfo().userName}/workspace/${name}`,
      isHome: false,
    })),
    { name: 'Browse...', path: null, isBrowse: true },
  ];
  // We don't have process.env in renderer, so we'll get HOME from the preload
  // Actually, HOME is available via directory listing. Let's use a simpler approach:
  // The main process resolves paths. We send directory names and let main handle it.

  pickerSearch.value = '';
  pickerSelectedIndex = 0;
  renderPickerList('');
  pickerOverlay.classList.remove('hidden');
  pickerSearch.focus();
}

function closePicker() {
  pickerOverlay.classList.add('hidden');
}

function renderPickerList(filter) {
  const filtered = pickerDirs.filter((d) =>
    d.name.toLowerCase().includes(filter.toLowerCase())
  );
  pickerList.innerHTML = '';
  filtered.forEach((dir, i) => {
    const li = document.createElement('li');
    li.textContent = dir.name;
    li.classList.toggle('selected', i === pickerSelectedIndex);
    li.addEventListener('click', () => selectPickerItem(dir));
    li.addEventListener('mouseenter', () => {
      pickerSelectedIndex = i;
      renderPickerList(pickerSearch.value);
    });
    pickerList.appendChild(li);
  });
}

async function selectPickerItem(dir) {
  closePicker();
  let directory;
  if (dir.isHome) {
    directory = await electronAPI.listWorkspaceDirs().then(() => null); // placeholder
    // We need home dir from main. Let's just use a known path approach.
    // Actually, we'll add a getHomePath IPC. For now, hardcode approach:
    // Better: we'll send 'HOME' as a sentinel and main process resolves it.
    directory = '~'; // Main process will resolve
  } else if (dir.isBrowse) {
    directory = await electronAPI.openDirectoryDialog();
    if (!directory) return;
  } else {
    directory = dir.path;
  }
  createTab(directory);
}

pickerSearch.addEventListener('input', () => {
  pickerSelectedIndex = 0;
  renderPickerList(pickerSearch.value);
});

pickerSearch.addEventListener('keydown', (e) => {
  const items = pickerList.querySelectorAll('li');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    pickerSelectedIndex = Math.min(pickerSelectedIndex + 1, items.length - 1);
    renderPickerList(pickerSearch.value);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    pickerSelectedIndex = Math.max(pickerSelectedIndex - 1, 0);
    renderPickerList(pickerSearch.value);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const filtered = pickerDirs.filter((d) =>
      d.name.toLowerCase().includes(pickerSearch.value.toLowerCase())
    );
    if (filtered[pickerSelectedIndex]) {
      selectPickerItem(filtered[pickerSelectedIndex]);
    }
  } else if (e.key === 'Escape') {
    closePicker();
  }
});

pickerOverlay.addEventListener('click', (e) => {
  if (e.target === pickerOverlay) closePicker();
});
```

- [ ] **Step 8: Add session save/restore**

```js
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveSessionsSync(), 1000);
}

function saveSessionsSync() {
  const bounds = {}; // Will be filled by main process on quit
  const sessionData = {
    version: 1,
    window: bounds,
    sidebarWidth,
    tabs: tabs.map((t) => ({ directory: t.directory, customName: t.customName })),
    activeTabIndex: tabs.findIndex((t) => t.id === activeTabId),
  };
  electronAPI.saveSessions(sessionData);
}

// PTY events
electronAPI.onPtyData((tabId, data) => {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) tab.terminal.write(data);
});

electronAPI.onPtyExit((tabId, exitCode) => {
  const tab = tabs.find((t) => t.id === tabId);
  if (tab) {
    tab.exited = true;
    tab.terminal.writeln('');
    tab.terminal.writeln('\x1b[33m[Session ended. Press Enter to restart or Cmd+W to close]\x1b[0m');
  }
});

// Menu events from main process
electronAPI.onPtyData; // already set up
// We need to listen for menu events too — add to preload
```

- [ ] **Step 9: Add sidebar resize**

```js
let isResizing = false;

resizeHandle.addEventListener('mousedown', (e) => {
  isResizing = true;
  document.body.style.cursor = 'col-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const newWidth = Math.min(400, Math.max(120, e.clientX));
  sidebarWidth = newWidth;
  sidebarEl.style.width = `${newWidth}px`;
  // Refit active terminal
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (activeTab) {
    activeTab.fitAddon.fit();
    electronAPI.resizePty(activeTab.id, activeTab.terminal.cols, activeTab.terminal.rows);
  }
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = '';
    scheduleSave();
  }
});
```

- [ ] **Step 10: Add keyboard shortcuts and window resize**

```js
// Tab switching via Cmd+1-9 and Cmd+Shift+[/]
document.addEventListener('keydown', (e) => {
  if (e.metaKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const index = parseInt(e.key) - 1;
    if (tabs[index]) switchTab(tabs[index].id);
  }
  if (e.metaKey && e.shiftKey && e.key === '[') {
    e.preventDefault();
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    if (currentIndex > 0) switchTab(tabs[currentIndex - 1].id);
  }
  if (e.metaKey && e.shiftKey && e.key === ']') {
    e.preventDefault();
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    if (currentIndex < tabs.length - 1) switchTab(tabs[currentIndex + 1].id);
  }
});

// Resize terminal on window resize
window.addEventListener('resize', () => {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (activeTab) {
    activeTab.fitAddon.fit();
    electronAPI.resizePty(activeTab.id, activeTab.terminal.cols, activeTab.terminal.rows);
  }
});

// New tab button
newTabBtn.addEventListener('click', openPicker);
```

- [ ] **Step 11: Add initialization (session restore)**

```js
// Listen for restored session from main
window.electronAPI.onSessionRestored = null; // Will add to preload

async function init() {
  const sessionData = await electronAPI.loadSessions();
  const data = sessionData || { tabs: [{ directory: '~', customName: null }], activeTabIndex: 0, sidebarWidth: 200 };

  sidebarWidth = data.sidebarWidth || 200;
  sidebarEl.style.width = `${sidebarWidth}px`;

  for (const tabData of data.tabs) {
    createTab(tabData.directory, tabData.customName);
  }

  if (data.activeTabIndex >= 0 && data.activeTabIndex < tabs.length) {
    switchTab(tabs[data.activeTabIndex].id);
  }
}

init();
```

- [ ] **Step 12: Commit**

```bash
git add src/renderer/app.js
git commit -m "feat: add renderer with tab management, terminal, picker, shortcuts"
```

---

### Task 9: Wire up missing IPC — menu events, home dir resolution, window bounds on save

**Files:**
- Modify: `src/preload/preload.js`
- Modify: `src/main/main.js`
- Modify: `src/renderer/app.js`

- [ ] **Step 1: Add menu event listeners and getHomePath to preload**

Add to preload.js `electronAPI`:

```js
  // Menu events (main -> renderer)
  onNewTab: (callback) => ipcRenderer.on('menu:new-tab', () => callback()),
  onCloseTab: (callback) => ipcRenderer.on('menu:close-tab', () => callback()),

  // Utility
  getHomePath: () => ipcRenderer.invoke('util:home-path'),
  getWindowBounds: () => ipcRenderer.invoke('util:window-bounds'),
```

- [ ] **Step 2: Add IPC handlers in main.js**

Add before `app.whenReady()`:

```js
ipcMain.handle('util:home-path', () => os.homedir());

ipcMain.handle('util:window-bounds', () => {
  if (!mainWindow) return null;
  const bounds = mainWindow.getBounds();
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
});
```

- [ ] **Step 3: Wire menu events in renderer app.js**

Add to init():

```js
electronAPI.onNewTab(() => openPicker());
electronAPI.onCloseTab(() => {
  if (activeTabId) closeTab(activeTabId);
});
```

- [ ] **Step 4: Fix directory picker to resolve ~ via IPC**

Update `selectPickerItem` to use `await electronAPI.getHomePath()` for the home directory case, and construct workspace paths using it:

```js
async function selectPickerItem(dir) {
  closePicker();
  let directory;
  if (dir.isHome) {
    directory = await electronAPI.getHomePath();
  } else if (dir.isBrowse) {
    directory = await electronAPI.openDirectoryDialog();
    if (!directory) return;
  } else {
    directory = dir.path;
  }
  createTab(directory);
}
```

Also fix `openPicker` to get home path for constructing workspace paths:

```js
async function openPicker() {
  const homePath = await electronAPI.getHomePath();
  const workspaceDirs = await electronAPI.listWorkspaceDirs();
  pickerDirs = [
    { name: '~ (Home)', path: homePath, isHome: true },
    ...workspaceDirs.map((name) => ({
      name,
      path: `${homePath}/workspace/${name}`,
    })),
    { name: 'Browse...', path: null, isBrowse: true },
  ];
  // ... rest unchanged
}
```

- [ ] **Step 5: Fix saveSessionsSync to include window bounds**

```js
async function saveSessionsSync() {
  const bounds = await electronAPI.getWindowBounds();
  const sessionData = {
    version: 1,
    window: bounds || { width: 1200, height: 800 },
    sidebarWidth,
    tabs: tabs.map((t) => ({ directory: t.directory, customName: t.customName })),
    activeTabIndex: tabs.findIndex((t) => t.id === activeTabId),
  };
  electronAPI.saveSessions(sessionData);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/preload/preload.js src/main/main.js src/renderer/app.js
git commit -m "feat: wire up menu events, home dir resolution, window bounds"
```

---

### Task 10: Bundle, run, and smoke test

- [ ] **Step 1: Bundle the renderer**

```bash
cd /Users/joseph.sak/workspace/claude-code-desktop
npm run bundle
```

Expected: `src/renderer/bundle.js` created without errors.

- [ ] **Step 2: Run the app**

```bash
npm start
```

Expected: Window appears with dark theme, sidebar on left with one tab showing home directory name, terminal area shows Claude Code starting (or auth prompt).

- [ ] **Step 3: Smoke test checklist**

Manually verify:
- [ ] Tab shows correct folder name
- [ ] Cmd+T opens directory picker
- [ ] Search filters workspace directories
- [ ] Selecting a directory opens new tab with claude
- [ ] Cmd+W closes tab
- [ ] Cmd+1/2/3 switches tabs
- [ ] Double-click tab name to rename
- [ ] Drag tabs to reorder
- [ ] Sidebar resize works
- [ ] Quit and relaunch restores tabs
- [ ] Terminal title escape codes don't change tab name

- [ ] **Step 4: Fix any issues found during smoke test**

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: smoke test fixes"
```

---

## Chunk 2: Polish and Packaging

### Task 11: Handle PTY session end/restart UX

**Files:**
- Modify: `src/renderer/app.js`

- [ ] **Step 1: Verify PTY exit message appears**

When a claude session exits, verify the yellow "[Session ended...]" message appears. Press Enter and verify it restarts.

- [ ] **Step 2: Verify claude not found error**

Temporarily rename claude to test the error case. The PTY should exit immediately and show the session ended message.

- [ ] **Step 3: Commit any fixes**

---

### Task 12: Add app icon and electron-builder config

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add electron-builder config to package.json**

```json
{
  "build": {
    "appId": "com.claudecode.desktop",
    "productName": "Claude Code Desktop",
    "mac": {
      "category": "public.app-category.developer-tools",
      "target": "dmg"
    },
    "files": [
      "src/**/*",
      "node_modules/**/*"
    ],
    "extraResources": []
  }
}
```

- [ ] **Step 2: Build the distributable**

```bash
npm run dist
```

Expected: `.dmg` file created in `dist/` directory.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add electron-builder config for macOS packaging"
```

---

### Task 13: Add CLAUDE.md and README

**Files:**
- Create: `CLAUDE.md` (update existing if present)
- Modify: `README.md`

- [ ] **Step 1: Update CLAUDE.md with dev instructions**

```markdown
# CLAUDE.md

## Build/Run Commands
- `npm run start` — rebuild native modules, bundle renderer, launch app
- `npm run bundle` — bundle renderer JS with esbuild
- `npm run rebuild` — rebuild node-pty for Electron
- `npm run dist` — build distributable .dmg

## Architecture
- Electron app: main process (src/main/), preload (src/preload/), renderer (src/renderer/)
- Renderer is bundled via esbuild (ESM -> IIFE) to src/renderer/bundle.js
- node-pty must be rebuilt for Electron's Node version after npm install

## Code Style
- Main process: CommonJS (require/module.exports)
- Renderer: ESM (import/export), bundled by esbuild
- No framework — vanilla HTML/CSS/JS
- Colors defined in src/renderer/theme.js
```

- [ ] **Step 2: Write README.md**

Brief README covering what the app does, how to install deps, how to run in dev, and how to build.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: add development instructions"
```
