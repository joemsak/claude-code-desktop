# Dangerous Mode, DevTools Integration, and UI Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dangerous mode launch (CMD+SHIFT+T with --dangerously-skip-permissions), a default setting toggle, claude-devtools menu integration, remove hover peek, fix tab drag handle and topbar + button alignment.

**Architecture:** Seven independent changes, most touching different files. The dangerous mode feature threads through pty-manager → main IPC → preload → renderer. The rest are UI/CSS changes and dead code removal.

**Tech Stack:** Electron (CommonJS main, ESM renderer), node-pty, xterm.js, vitest, esbuild

---

### Task 1: Remove Hover Peek (Dead Code Removal)

This goes first because multiple later tasks touch the same files, and removing peek simplifies them.

**Files:**
- Modify: `src/renderer/app.js:11,42-45,84,223-238,271-324,408`
- Modify: `src/renderer/index.html:25-31`
- Modify: `src/renderer/styles.css:685-742`
- Delete: `src/renderer/strip-tui-chrome.js`
- Delete: `test/hover-peek.test.mjs`
- Delete: `test/peek-cancel-on-switch.test.mjs`
- Delete: `test/peek-strip-chrome.test.mjs`
- Delete: `test/peek-terminal-buffer.test.mjs`
- Delete: `test/ui-peek-slide.test.mjs`

- [ ] **Step 1: Delete peek test files**

```bash
rm test/hover-peek.test.mjs test/peek-cancel-on-switch.test.mjs test/peek-strip-chrome.test.mjs test/peek-terminal-buffer.test.mjs test/ui-peek-slide.test.mjs
```

- [ ] **Step 2: Delete strip-tui-chrome module**

```bash
rm src/renderer/strip-tui-chrome.js
```

- [ ] **Step 3: Remove peek from index.html**

Remove lines 25-31 (the `#peek-panel` element and its children):

```html
<!-- DELETE this entire block -->
    <div id="peek-panel" class="hidden">
      <div id="peek-header">
        <span id="peek-tab-name"></span>
        <span id="peek-tab-status"></span>
      </div>
      <pre id="peek-content"></pre>
    </div>
```

- [ ] **Step 4: Remove peek from app.js**

Remove the `stripTuiChrome` import (line 11):
```javascript
// DELETE this line
import { stripTuiChrome } from "./strip-tui-chrome.js";
```

Remove peek DOM refs (lines 42-45):
```javascript
// DELETE these lines
const peekPanel = document.getElementById("peek-panel");
const peekTabName = document.getElementById("peek-tab-name");
const peekTabStatus = document.getElementById("peek-tab-status");
const peekContent = document.getElementById("peek-content");
```

Remove `MAX_BUFFER_LINES` constant (line 84):
```javascript
// DELETE this line
const MAX_BUFFER_LINES = 20;
```

Remove mouseenter/mouseleave peek handlers from renderSidebar (lines 223-238):
```javascript
// DELETE this entire block
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
```

Remove the entire Hover Peek section (lines 271-324):
```javascript
// DELETE this entire section
// ===========================
// Hover Peek
// ===========================

let peekTimeout = null;
let peekTabId = null;

function showPeek(tab, tabEl) { ... }
function hidePeek() { ... }
peekPanel.addEventListener("mouseenter", ...);
peekPanel.addEventListener("mouseleave", ...);
```

Remove `hidePeek()` call from switchTab (line 408):
```javascript
// In switchTab, DELETE this line:
  hidePeek();
```

- [ ] **Step 5: Remove peek CSS from styles.css**

Remove the entire `/* --- Peek Panel --- */` section (lines 685-742):
```css
/* DELETE from "/* --- Peek Panel --- */" through "#peek-content::-webkit-scrollbar-thumb" */
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: All remaining tests pass. The 5 deleted peek tests are gone. No references to peek remain.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove hover peek feature on inactive tabs"
```

---

### Task 2: Fix Tab Drag Handle (No Text Shift + Better Visibility)

**Files:**
- Modify: `src/renderer/styles.css:239-256`
- Modify: `test/ui-tab-hover-lift.test.mjs` (update to reflect removal of translateX)
- Modify: `test/ui-drag-handle.test.mjs` (add visibility assertions)

- [ ] **Step 1: Update ui-tab-hover-lift test**

The test currently asserts `translateX` exists in hover. Update it to assert it does NOT exist:

Replace the full content of `test/ui-tab-hover-lift.test.mjs`:
```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('tab hover', () => {
  it('tab-entry has transition for background and color', () => {
    const tabEntryBlock = cssSource.match(/\.tab-entry\s*\{[^}]*\}/);
    expect(tabEntryBlock).not.toBeNull();
    expect(tabEntryBlock[0]).toContain('transition');
  });

  it('tab-entry hover does NOT shift text with translateX', () => {
    const hoverBlock = cssSource.match(/\.tab-entry:hover\s*\{[^}]*\}/);
    expect(hoverBlock).not.toBeNull();
    expect(hoverBlock[0]).not.toContain('translateX');
  });
});
```

- [ ] **Step 2: Update ui-drag-handle test**

Replace the full content of `test/ui-drag-handle.test.mjs`:
```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('drag handle affordance', () => {
  it('tab-entry has a before pseudo-element for drag handle', () => {
    expect(cssSource).toContain('.tab-entry:hover::before');
  });

  it('drag cursor shows grab on hover', () => {
    expect(cssSource).toContain('cursor: grab');
  });

  it('drag handle uses 14px font size for visibility', () => {
    const beforeBlock = cssSource.match(/\.tab-entry:hover::before\s*\{[^}]*\}/);
    expect(beforeBlock).not.toBeNull();
    expect(beforeBlock[0]).toContain('font-size: 14px');
  });

  it('drag handle uses overlay1 color for visibility', () => {
    const beforeBlock = cssSource.match(/\.tab-entry:hover::before\s*\{[^}]*\}/);
    expect(beforeBlock).not.toBeNull();
    expect(beforeBlock[0]).toContain('var(--overlay1)');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test
```

Expected: `ui-tab-hover-lift` and `ui-drag-handle` tests fail (CSS still has old values).

- [ ] **Step 4: Fix the CSS**

In `src/renderer/styles.css`, replace the `.tab-entry:hover` block (lines 239-243):

```css
.tab-entry:hover {
  background: var(--base);
  color: var(--text);
}
```

Replace the `.tab-entry:hover::before` block (lines 245-256):

```css
.tab-entry:hover::before {
  content: "\udb80\udf5c";
  font-family: var(--terminal-font);
  position: absolute;
  left: 1px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--overlay1);
  font-size: 14px;
  cursor: grab;
}
```

Also remove `transform` from the `.tab-entry` transition (line 211) — it's no longer animated:

Change:
```css
  transition: background 0.1s, color 0.1s, transform 0.15s ease-out;
```
To:
```css
  transition: background 0.1s, color 0.1s;
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/styles.css test/ui-tab-hover-lift.test.mjs test/ui-drag-handle.test.mjs
git commit -m "fix: tab drag handle no longer shifts text, increased visibility"
```

---

### Task 3: Fix Topbar + Button Centering

**Files:**
- Modify: `src/renderer/styles.css:141-161`
- Create: `test/ui-topbar-new-tab-btn.test.mjs`

- [ ] **Step 1: Write failing test**

Create `test/ui-topbar-new-tab-btn.test.mjs`:
```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('topbar new tab button centering', () => {
  it('uses flex centering for the icon', () => {
    const btnBlock = cssSource.match(/#topbar-new-tab\s*\{[^}]*\}/);
    expect(btnBlock).not.toBeNull();
    expect(btnBlock[0]).toContain('display: flex');
    expect(btnBlock[0]).toContain('align-items: center');
    expect(btnBlock[0]).toContain('justify-content: center');
  });

  it('uses fixed dimensions for symmetric hover background', () => {
    const btnBlock = cssSource.match(/#topbar-new-tab\s*\{[^}]*\}/);
    expect(btnBlock).not.toBeNull();
    expect(btnBlock[0]).toContain('width:');
    expect(btnBlock[0]).toContain('height:');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — current CSS doesn't have `display: flex` or fixed width/height.

- [ ] **Step 3: Fix the CSS**

Replace `#topbar-new-tab` in `src/renderer/styles.css` (lines 141-152):

```css
#topbar-new-tab {
  -webkit-app-region: no-drag;
  background: none;
  border: none;
  color: var(--subtext0);
  font-size: 18px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  border-radius: 4px;
  transition: color 0.1s, background 0.1s;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/styles.css test/ui-topbar-new-tab-btn.test.mjs
git commit -m "fix: center topbar + button icon within hover background"
```

---

### Task 4: Dangerous Mode — PTY Manager + IPC Plumbing

**Files:**
- Modify: `src/main/pty-manager.js:12,24`
- Modify: `src/main/main.js:86-102`
- Modify: `src/preload/preload.js:5-6`
- Modify: `test/pty-manager.test.mjs`

- [ ] **Step 1: Write failing pty-manager tests**

Add these tests to the end of the `spawn` describe block in `test/pty-manager.test.mjs`:

```javascript
    it('appends --dangerously-skip-permissions when options.dangerousMode is true', () => {
      manager.spawn('tab-d', '/tmp', vi.fn(), vi.fn(), { dangerousMode: true });
      const args = mock.mockSpawn.mock.calls[0][1];
      const cmd = args[args.length - 1];
      expect(cmd).toContain('exec claude --dangerously-skip-permissions');
    });

    it('does not append flag when options.dangerousMode is false', () => {
      manager.spawn('tab-n', '/tmp', vi.fn(), vi.fn(), { dangerousMode: false });
      const args = mock.mockSpawn.mock.calls[0][1];
      const cmd = args[args.length - 1];
      expect(cmd).toMatch(/exec claude$/);
    });

    it('does not append flag when options is omitted', () => {
      manager.spawn('tab-o', '/tmp', vi.fn(), vi.fn());
      const args = mock.mockSpawn.mock.calls[0][1];
      const cmd = args[args.length - 1];
      expect(cmd).toMatch(/exec claude$/);
    });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- test/pty-manager.test.mjs
```

Expected: FAIL — `spawn` doesn't accept 5th parameter yet.

- [ ] **Step 3: Implement pty-manager change**

In `src/main/pty-manager.js`, change the `spawn` signature (line 12) and command (line 24):

Replace:
```javascript
  function spawn(tabId, directory, onData, onExit) {
```
With:
```javascript
  function spawn(tabId, directory, onData, onExit, options) {
```

Replace:
```javascript
    const cmd = "source ~/.zshrc 2>/dev/null; exec claude";
```
With:
```javascript
    const flag = options && options.dangerousMode ? " --dangerously-skip-permissions" : "";
    const cmd = `source ~/.zshrc 2>/dev/null; exec claude${flag}`;
```

- [ ] **Step 4: Run pty-manager tests**

```bash
npm test -- test/pty-manager.test.mjs
```

Expected: All pass.

- [ ] **Step 5: Update IPC handler in main.js**

In `src/main/main.js`, change the `pty:spawn` handler (line 86):

Replace:
```javascript
ipcMain.on("pty:spawn", (event, tabId, directory) => {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) return;

  ptyManager.spawn(
    tabId,
    directory,
    (id, data) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("pty:data", id, data);
      }
    },
    (id, exitCode) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("pty:exit", id, exitCode);
      }
    },
  );
});
```

With:
```javascript
ipcMain.on("pty:spawn", (event, tabId, directory, options) => {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) return;

  ptyManager.spawn(
    tabId,
    directory,
    (id, data) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("pty:data", id, data);
      }
    },
    (id, exitCode) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("pty:exit", id, exitCode);
      }
    },
    options,
  );
});
```

- [ ] **Step 6: Update preload bridge**

In `src/preload/preload.js`, change `spawnPty` (line 5-6):

Replace:
```javascript
  spawnPty: (tabId, directory) =>
    ipcRenderer.send("pty:spawn", tabId, directory),
```

With:
```javascript
  spawnPty: (tabId, directory, options) =>
    ipcRenderer.send("pty:spawn", tabId, directory, options),
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add src/main/pty-manager.js src/main/main.js src/preload/preload.js test/pty-manager.test.mjs
git commit -m "feat: pty-manager accepts dangerousMode option for --dangerously-skip-permissions"
```

---

### Task 5: Default Dangerous Mode Setting

**Files:**
- Modify: `src/main/session-store.js:10-22`
- Modify: `src/main/main.js:184-219`
- Modify: `src/preload/preload.js`
- Modify: `test/session-store.test.mjs`
- Modify: `test/settings-ui.test.mjs`

- [ ] **Step 1: Write failing tests**

Add to `test/session-store.test.mjs` (inside the existing describe block):

```javascript
  it('DEFAULT_SESSION includes defaultDangerousMode as false', () => {
    expect(store.DEFAULT_SESSION.defaultDangerousMode).toBe(false);
  });
```

Add to `test/settings-ui.test.mjs`:

```javascript
  it('settings:load returns defaultDangerousMode', () => {
    expect(mainSource).toContain('data.defaultDangerousMode');
  });

  it('settings:save handles defaultDangerousMode', () => {
    expect(mainSource).toContain('settings.defaultDangerousMode');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/session-store.test.mjs test/settings-ui.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Add defaultDangerousMode to session store**

In `src/main/session-store.js`, add to `DEFAULT_SESSION` (after line 21):

```javascript
    fontSize: 14,
    defaultDangerousMode: false,
```

- [ ] **Step 4: Update settings:load in main.js**

In `src/main/main.js`, add `defaultDangerousMode` to the `settings:load` return value (after line 192):

Replace:
```javascript
ipcMain.handle("settings:load", () => {
  const data = sessionStore.load() || sessionStore.DEFAULT_SESSION;
  return {
    workspaceDir:
      data.workspaceDir || sessionStore.DEFAULT_SESSION.workspaceDir,
    theme: data.theme || sessionStore.DEFAULT_SESSION.theme,
    fontFamily: data.fontFamily || sessionStore.DEFAULT_SESSION.fontFamily,
    fontSize: data.fontSize || sessionStore.DEFAULT_SESSION.fontSize,
  };
});
```

With:
```javascript
ipcMain.handle("settings:load", () => {
  const data = sessionStore.load() || sessionStore.DEFAULT_SESSION;
  return {
    workspaceDir:
      data.workspaceDir || sessionStore.DEFAULT_SESSION.workspaceDir,
    theme: data.theme || sessionStore.DEFAULT_SESSION.theme,
    fontFamily: data.fontFamily || sessionStore.DEFAULT_SESSION.fontFamily,
    fontSize: data.fontSize || sessionStore.DEFAULT_SESSION.fontSize,
    defaultDangerousMode: data.defaultDangerousMode || false,
  };
});
```

- [ ] **Step 5: Update settings:save in main.js**

In `src/main/main.js`, add handling for `defaultDangerousMode` in the `settings:save` handler. After the `themeBaseColor` check (after line 217):

```javascript
  if (typeof settings.defaultDangerousMode === "boolean") {
    data.defaultDangerousMode = settings.defaultDangerousMode;
  }
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/main/session-store.js src/main/main.js test/session-store.test.mjs test/settings-ui.test.mjs
git commit -m "feat: add defaultDangerousMode setting to session store and IPC"
```

---

### Task 6: Dangerous Mode Confirmation Modal (UI)

**Files:**
- Modify: `src/renderer/index.html` (add confirmation modal DOM)
- Modify: `src/renderer/styles.css` (add confirmation modal styles)
- Modify: `src/renderer/app.js` (add modal logic, wire to picker flow)
- Create: `test/dangerous-mode-confirm.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `test/dangerous-mode-confirm.test.mjs`:
```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('dangerous mode confirmation modal', () => {
  it('has a confirm overlay element in the HTML', () => {
    expect(htmlSource).toContain('id="confirm-dangerous-overlay"');
  });

  it('has launch-dangerous and launch-normal buttons', () => {
    expect(htmlSource).toContain('id="confirm-dangerous-btn"');
    expect(htmlSource).toContain('id="confirm-normal-btn"');
  });

  it('has a link to open settings from the modal', () => {
    expect(htmlSource).toContain('id="confirm-settings-link"');
  });

  it('has CSS styles for the confirmation overlay', () => {
    expect(cssSource).toContain('#confirm-dangerous-overlay');
  });

  it('app.js has a showDangerousConfirm function', () => {
    expect(appSource).toContain('function showDangerousConfirm');
  });

  it('picker selection checks pendingDangerousMode before creating tab', () => {
    expect(appSource).toContain('pendingDangerousMode');
  });

  it('escape key on confirmation modal triggers normal launch', () => {
    // The keydown handler for the confirm overlay should handle Escape
    expect(appSource).toMatch(/confirm.*Escape|Escape.*confirm/s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- test/dangerous-mode-confirm.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Add confirmation modal DOM to index.html**

Add after the settings overlay closing `</div>` (after line 91), before the `<script>` tag:

```html
  <div id="confirm-dangerous-overlay" class="hidden">
    <div id="confirm-dangerous-modal">
      <div id="confirm-dangerous-icon">⚠️</div>
      <div id="confirm-dangerous-title">Skip Permission Prompts?</div>
      <div id="confirm-dangerous-body">
        Claude will execute commands <strong>without asking for approval</strong>. Only use this in trusted workspaces.
      </div>
      <div id="confirm-dangerous-buttons">
        <button id="confirm-dangerous-btn">Launch Dangerous</button>
        <button id="confirm-normal-btn">Launch Normal</button>
      </div>
      <div id="confirm-dangerous-footer">
        <span id="confirm-settings-link">Change default mode in Settings</span>
      </div>
      <div id="confirm-dangerous-note" class="hidden">This is your default — launched via Cmd+T</div>
    </div>
  </div>
```

- [ ] **Step 4: Add confirmation modal CSS to styles.css**

Add at the end of the file:

```css
/* --- Dangerous Mode Confirmation --- */
#confirm-dangerous-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  animation: fadeIn 0.15s ease-out;
}

#confirm-dangerous-modal {
  width: 380px;
  background: var(--surface0);
  border: 1px solid var(--surface1);
  border-radius: 10px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  text-align: center;
}

#confirm-dangerous-icon {
  font-size: 20px;
  margin-bottom: 8px;
}

#confirm-dangerous-title {
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

#confirm-dangerous-body {
  color: var(--subtext1);
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 16px;
}

#confirm-dangerous-body strong {
  color: var(--red);
}

#confirm-dangerous-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

#confirm-dangerous-btn {
  flex: 1;
  background: var(--red);
  color: var(--base);
  border: none;
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.1s;
}

#confirm-dangerous-btn:hover {
  opacity: 0.9;
}

#confirm-normal-btn {
  flex: 1;
  background: var(--surface1);
  color: var(--text);
  border: none;
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.1s;
}

#confirm-normal-btn:hover {
  background: var(--surface2);
}

#confirm-dangerous-footer {
  text-align: center;
}

#confirm-settings-link {
  color: var(--blue);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

#confirm-settings-link:hover {
  color: var(--text);
}

#confirm-dangerous-note {
  margin-top: 10px;
  background: var(--surface1);
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--subtext1);
  font-size: 10px;
}
```

- [ ] **Step 5: Add confirmation modal logic to app.js**

Add DOM refs after the existing DOM refs section (after the settings refs around line 53):

```javascript
const confirmOverlay = document.getElementById("confirm-dangerous-overlay");
const confirmDangerousBtn = document.getElementById("confirm-dangerous-btn");
const confirmNormalBtn = document.getElementById("confirm-normal-btn");
const confirmSettingsLink = document.getElementById("confirm-settings-link");
const confirmNote = document.getElementById("confirm-dangerous-note");
```

Add state variable near the top state section (after line 24):

```javascript
let defaultDangerousMode = false;
```

Add a `pendingDangerousMode` variable in the picker state area (after line 512, near `pickerDirs`):

```javascript
let pendingDangerousMode = false;
let pendingDirectory = null;
```

Modify `openPicker` to accept a mode parameter. Change (line 514):

```javascript
async function openPicker(dangerousMode = false) {
  pendingDangerousMode = dangerousMode;
```

(Rest of openPicker stays the same.)

Modify `selectPickerItem` to check dangerous mode (replace lines 679-689):

```javascript
async function selectPickerItem(dir) {
  closePicker();
  let directory;
  if (dir.isBrowse) {
    directory = await electronAPI.openDirectoryDialog();
    if (!directory) return;
  } else {
    directory = dir.path;
  }
  if (pendingDangerousMode) {
    showDangerousConfirm(directory);
  } else {
    createTab(directory);
  }
}
```

Add the confirmation functions after the picker section:

```javascript
// ===========================
// Dangerous Mode Confirmation
// ===========================

function showDangerousConfirm(directory) {
  pendingDirectory = directory;
  // Show note when this was triggered via the default shortcut (Cmd+T with default ON)
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
  openSettings();
});

confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) {
    const dir = pendingDirectory;
    closeDangerousConfirm();
    createTab(dir);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !confirmOverlay.classList.contains("hidden")) {
    e.preventDefault();
    const dir = pendingDirectory;
    closeDangerousConfirm();
    createTab(dir);
    return;
  }
});
```

- [ ] **Step 6: Update createTab to accept options and pass to spawnPty**

Modify `createTab` signature (line 338):

Replace:
```javascript
function createTab(directory, customName = null, originalDir = null) {
```
With:
```javascript
function createTab(directory, customName = null, originalDir = null, options = {}) {
```

Add `dangerousMode` to the tab object (inside the tab creation, after `_originalDir: originalDir`):

```javascript
    _originalDir: originalDir,
    dangerousMode: !!options.dangerousMode,
```

Update the `spawnPty` call (line 394):

Replace:
```javascript
  electronAPI.spawnPty(id, directory);
```
With:
```javascript
  electronAPI.spawnPty(id, directory, { dangerousMode: !!options.dangerousMode });
```

Update `restartTab` to pass the mode (line 449-453):

Replace:
```javascript
function restartTab(tab) {
  tab.exited = false;
  tab.terminal.clear();
  electronAPI.spawnPty(tab.id, tab.directory);
}
```
With:
```javascript
function restartTab(tab) {
  tab.exited = false;
  tab.terminal.clear();
  electronAPI.spawnPty(tab.id, tab.directory, { dangerousMode: tab.dangerousMode });
}
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/index.html src/renderer/styles.css src/renderer/app.js test/dangerous-mode-confirm.test.mjs
git commit -m "feat: dangerous mode confirmation modal with launch/normal/settings options"
```

---

### Task 7: Settings Toggle + Shortcuts + Menu

**Files:**
- Modify: `src/renderer/index.html` (add toggle to settings)
- Modify: `src/renderer/styles.css` (toggle switch styles)
- Modify: `src/renderer/app.js` (load setting, wire toggle, update shortcuts)
- Modify: `src/main/main.js` (add Cmd+Shift+T menu item, menu rebuild IPC)
- Modify: `src/preload/preload.js` (add menu event listeners)
- Create: `test/dangerous-mode-settings.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `test/dangerous-mode-settings.test.mjs`:
```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf-8');
const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload', 'preload.js'), 'utf-8');

describe('dangerous mode settings toggle', () => {
  it('has a toggle switch in settings HTML', () => {
    expect(htmlSource).toContain('id="settings-dangerous-toggle"');
  });

  it('app.js loads defaultDangerousMode on startup', () => {
    expect(appSource).toContain('defaultDangerousMode');
    expect(appSource).toContain('startupSettings.defaultDangerousMode');
  });

  it('toggle change saves the setting', () => {
    expect(appSource).toContain('defaultDangerousMode');
  });
});

describe('dangerous mode shortcuts', () => {
  it('main.js has Cmd+Shift+T menu item', () => {
    expect(mainSource).toContain('CmdOrCtrl+Shift+T');
  });

  it('preload exposes onNewTabDangerous event', () => {
    expect(preloadSource).toContain('menu:new-tab-dangerous');
  });

  it('app.js listens for the dangerous tab menu event', () => {
    expect(appSource).toContain('onNewTabDangerous');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/dangerous-mode-settings.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Add toggle to settings HTML**

In `src/renderer/index.html`, add before the closing `</div>` of `#settings-body` (after the Custom Themes group, before line 89):

```html
        <div class="settings-group settings-separator"></div>
        <div class="settings-group">
          <div class="settings-toggle-row">
            <div class="settings-toggle-label">
              <label class="settings-label">Skip Permissions by Default</label>
              <p class="settings-hint">New tabs launch with --dangerously-skip-permissions</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="settings-dangerous-toggle">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <p class="settings-hint-small" style="color: var(--red);">⚠️ A confirmation will still be shown before each launch</p>
        </div>
```

- [ ] **Step 4: Add toggle switch CSS**

Add to the end of `src/renderer/styles.css`:

```css
/* --- Toggle Switch --- */
.settings-toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings-toggle-label {
  flex: 1;
  min-width: 0;
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  margin-left: 12px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--surface1);
  border-radius: 10px;
  transition: background 0.2s;
}

.toggle-slider::before {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  bottom: 2px;
  background: var(--subtext1);
  border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--accent);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(16px);
  background: var(--base);
}
```

- [ ] **Step 5: Add toggle logic to app.js**

Add DOM ref (near the other settings refs):

```javascript
const settingsDangerousToggle = document.getElementById("settings-dangerous-toggle");
```

In `openSettings`, add after `settingsFontSize.value = ...` (after line 954):

```javascript
  settingsDangerousToggle.checked = settings.defaultDangerousMode || false;
```

Add event listener (after the `settingsOpenThemes` listener, around line 1015):

```javascript
settingsDangerousToggle.addEventListener("change", () => {
  defaultDangerousMode = settingsDangerousToggle.checked;
  saveSettingsValue("defaultDangerousMode", defaultDangerousMode);
  electronAPI.rebuildMenu(defaultDangerousMode);
});
```

In the `init` function, load the setting from startup settings (after `currentFontSize` is set, around line 1047):

```javascript
  defaultDangerousMode = startupSettings.defaultDangerousMode || false;
```

- [ ] **Step 6: Wire menu events for dangerous mode tab**

In `src/preload/preload.js`, add after the `onNewTab` line (after line 22):

```javascript
  onNewTabDangerous: (callback) =>
    ipcRenderer.on("menu:new-tab-dangerous", () => callback()),
  rebuildMenu: (defaultDangerous) =>
    ipcRenderer.invoke("menu:rebuild", defaultDangerous),
```

In `src/renderer/app.js`, add after the `electronAPI.onNewTab` line (after line 789):

```javascript
electronAPI.onNewTabDangerous(() => openPicker(true));
```

Update the existing `onNewTab` handler to be mode-aware:

Replace:
```javascript
electronAPI.onNewTab(() => openPicker());
```
With:
```javascript
electronAPI.onNewTab(() => openPicker(defaultDangerousMode));
electronAPI.onNewTabDangerous(() => openPicker(!defaultDangerousMode));
```

Wire the topbar and sidebar new-tab buttons to use the default mode:

Replace:
```javascript
newTabBtn.addEventListener("click", openPicker);
topbarNewTabBtn.addEventListener("click", openPicker);
emptyStateOpenBtn.addEventListener("click", openPicker);
```
With:
```javascript
newTabBtn.addEventListener("click", () => openPicker(defaultDangerousMode));
topbarNewTabBtn.addEventListener("click", () => openPicker(defaultDangerousMode));
emptyStateOpenBtn.addEventListener("click", () => openPicker(defaultDangerousMode));
```

- [ ] **Step 7: Add Cmd+Shift+T menu item and rebuild handler to main.js**

In `src/main/main.js`, extract the menu building into a function and add the rebuild IPC. Replace the menu section in `app.whenReady` (lines 304-330):

```javascript
function buildMenu(defaultDangerous) {
  const newTabLabel = defaultDangerous
    ? "New Tab (Skip Permissions)"
    : "New Tab";
  const dangerousTabLabel = defaultDangerous
    ? "New Tab (Standard)"
    : "New Tab (Skip Permissions)";

  const template = [
    { role: "appMenu" },
    {
      label: "File",
      submenu: [
        {
          label: newTabLabel,
          accelerator: "CmdOrCtrl+T",
          click: () => mainWindow?.webContents.send("menu:new-tab"),
        },
        {
          label: dangerousTabLabel,
          accelerator: "CmdOrCtrl+Shift+T",
          click: () =>
            mainWindow?.webContents.send("menu:new-tab-dangerous"),
        },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => mainWindow?.webContents.send("menu:close-tab"),
        },
        { type: "separator" },
        {
          label: "Settings...",
          accelerator: "CmdOrCtrl+,",
          click: () => mainWindow?.webContents.send("menu:open-settings"),
        },
      ],
    },
    { role: "editMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
```

In the `app.whenReady` callback, replace the inline menu building with:

```javascript
  const sessionData = sessionStore.load();
  buildMenu(sessionData?.defaultDangerousMode || false);
```

Add the rebuild IPC handler (after the other IPC handlers):

```javascript
ipcMain.handle("menu:rebuild", (_event, defaultDangerous) => {
  buildMenu(!!defaultDangerous);
});
```

- [ ] **Step 8: Run tests**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/index.html src/renderer/styles.css src/renderer/app.js src/main/main.js src/preload/preload.js test/dangerous-mode-settings.test.mjs
git commit -m "feat: dangerous mode settings toggle, Cmd+Shift+T shortcut, dynamic menu labels"
```

---

### Task 8: claude-devtools Menu Integration

**Files:**
- Modify: `src/main/main.js` (add View menu with devtools item)
- Create: `test/devtools-integration.test.mjs`

- [ ] **Step 1: Write failing test**

Create `test/devtools-integration.test.mjs`:
```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf-8');

describe('claude-devtools integration', () => {
  it('has a menu item for opening Claude DevTools', () => {
    expect(mainSource).toContain('Claude DevTools');
  });

  it('uses Cmd+Shift+D accelerator', () => {
    expect(mainSource).toContain('CmdOrCtrl+Shift+D');
  });

  it('launches the devtools app via shell', () => {
    expect(mainSource).toContain('claude-devtools');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- test/devtools-integration.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Add View menu to buildMenu in main.js**

In the `buildMenu` function, add a View menu after the File menu (before `{ role: "editMenu" }`):

```javascript
    {
      label: "View",
      submenu: [
        {
          label: "Open Claude DevTools",
          accelerator: "CmdOrCtrl+Shift+D",
          click: () => {
            const appPath = "/Applications/claude-devtools.app";
            if (fs.existsSync(appPath)) {
              shell.openPath(appPath);
            }
          },
        },
      ],
    },
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/main.js test/devtools-integration.test.mjs
git commit -m "feat: add View > Open Claude DevTools menu item (Cmd+Shift+D)"
```

---

### Task 9: Bundle, Smoke Test, and Final Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 3: Bundle**

```bash
npm run bundle
```

Expected: Bundle completes without errors.

- [ ] **Step 4: Launch app for smoke test**

```bash
npm run dev
```

Manual verification checklist:
1. App launches without errors
2. Cmd+T opens picker, launches normal tab
3. Cmd+Shift+T opens picker, shows confirmation modal
4. "Launch Dangerous" creates tab (check terminal for `--dangerously-skip-permissions`)
5. "Launch Normal" creates normal tab
6. Escape on confirmation modal creates normal tab
7. "Change default mode in Settings" opens settings
8. Toggle "Skip Permissions by Default" ON
9. Cmd+T now shows confirmation modal
10. Cmd+Shift+T now opens picker without confirmation
11. Tab hover shows drag handle (14px, bright) without shifting text
12. Topbar + button centered within hover background
13. Tab double-click rename works: input focused, text selected, clicking input doesn't revert
14. No hover peek on inactive tabs
15. Cmd+Shift+D opens Claude DevTools (if installed)

- [ ] **Step 5: Commit any lint/bundle fixes if needed**

```bash
git add -A
git commit -m "chore: lint and bundle fixes"
```

(Only if step 2 or 3 required changes.)
