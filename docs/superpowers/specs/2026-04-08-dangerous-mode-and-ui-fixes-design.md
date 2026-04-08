# Dangerous Mode, DevTools Integration, and UI Fixes

**Date:** 2026-04-08
**Status:** Draft

---

## Overview

Six changes in one minor release:

1. **Dangerous mode launch** — CMD+SHIFT+T opens picker, launches with `--dangerously-skip-permissions`, with in-app confirmation
2. **Default dangerous mode setting** — toggle in settings, swaps CMD+T / CMD+SHIFT+T behavior
3. **claude-devtools integration** — menu item to launch the DevTools app
4. **Remove hover peek** — strip the inactive tab preview feature entirely
5. **Tab drag handle fix** — remove text shift on hover, increase handle visibility
6. **Topbar + button centering** — fix off-center hover background
7. **Tab rename fix** — focus/select deferral and event propagation fixes (already implemented)

---

## 1. Dangerous Mode Launch

### Shortcut behavior

- `CMD+T` always uses the **default** mode (normal unless setting is flipped)
- `CMD+SHIFT+T` always uses the **opposite** of the default mode
- Both open the same picker — the mode is determined by which shortcut invoked it

### Spawn command

PTY manager currently runs:
```
source ~/.zshrc 2>/dev/null; exec claude
```

When dangerous mode is active:
```
source ~/.zshrc 2>/dev/null; exec claude --dangerously-skip-permissions
```

### Plumbing changes

**pty-manager.js** — `spawn(tabId, directory, callbacks, options)` gains an `options` parameter. When `options.dangerousMode` is true, append ` --dangerously-skip-permissions` to the command.

**main.js IPC** — `pty:spawn` handler accepts `(event, tabId, directory, options)` where options defaults to `{}`. Passes through to pty-manager.

**preload.js** — `spawnPty` gains the options parameter: `spawnPty(id, directory, options)`.

**Renderer** — `createTab(directory, customName, originalDir, options)` accepts and stores `dangerousMode` on the tab object. Picker tracks pending mode as module-level state set before opening.

### Confirmation modal

In-app overlay (not native dialog), shown after the user picks a directory when dangerous mode is requested.

**Structure:**
- Warning icon and "Skip Permission Prompts?" heading
- Body: "Claude will execute commands **without asking for approval**. Only use this in trusted workspaces."
- Two buttons side by side:
  - **"Launch Dangerous"** — red/accent background (`--red`), creates tab with dangerous mode
  - **"Launch Normal"** — neutral background (`--surface1`), creates tab without dangerous mode
- **"Change default mode in Settings"** link — always present, opens settings overlay
- When the setting is ON and CMD+T triggered the modal: extra note "This is your default — launched via Cmd+T"
- **Escape key** = Launch Normal (same as clicking the neutral button)

**DOM:** New overlay element in index.html, similar pattern to settings overlay. Hidden by default, shown via class toggle.

### "Launched in standard mode" feedback

When user declines dangerous mode, the tab launches normally. Brief visual indicator: the tab name flashes or shows a small "Standard" badge for 2 seconds, then fades. Keep it simple — a temporary CSS class that auto-removes via setTimeout.

---

## 2. Default Dangerous Mode Setting

### Storage

New field in session store: `defaultDangerousMode: false` (added to `DEFAULT_SESSION`).

### Settings UI

Added at the bottom of the settings form, separated by a border-top divider:

- **Label:** "Skip Permissions by Default"
- **Subtitle:** "New tabs launch with --dangerously-skip-permissions"
- **Control:** Toggle switch (not a checkbox — matches the app's style)
- **Warning note below:** "⚠️ A confirmation will still be shown before each launch"

### IPC

Loaded and saved through existing `settings:load` / `settings:save` handlers. No new IPC channels needed.

### Menu labels

The Electron menu items update dynamically based on the setting:
- When OFF: "New Tab" (Cmd+T) / "New Tab (Skip Permissions)" (Cmd+Shift+T)
- When ON: "New Tab (Skip Permissions)" (Cmd+T) / "New Tab (Standard)" (Cmd+Shift+T)

Menu is rebuilt when the setting changes (IPC from renderer to main after save).

---

## 3. claude-devtools Integration

### What it is

claude-devtools is a standalone Electron app that reads Claude Code session logs from `~/.claude/`. No API, no URL scheme, no path arguments — it has its own project navigation.

### Integration

**Menu item:** "Open Claude DevTools" in the View menu (or a Tools submenu if one exists).

**Accelerator:** `Cmd+Shift+D`

**Implementation:** `shell.openPath('/Applications/claude-devtools.app')` or `spawn('open', ['-a', 'claude-devtools'])`. Graceful fallback if the app isn't installed — show a brief notification or do nothing.

**Detection:** Check if `/Applications/claude-devtools.app` exists at menu build time. If not installed, disable the menu item or hide it.

---

## 4. Remove Hover Peek

Strip entirely:

**index.html:** Remove `#peek-panel` and its children (`#peek-tab-name`, `#peek-tab-status`, `#peek-content`).

**app.js:**
- Remove `peekPanel`, `peekTabName`, `peekTabStatus`, `peekContent` DOM references
- Remove `peekTimeout`, `peekTabId` state variables
- Remove `showPeek()` and `hidePeek()` functions
- Remove `mouseenter` / `mouseleave` event listeners on tab entries that trigger peek
- Remove `peekPanel.addEventListener` for mouseenter/mouseleave
- Remove `hidePeek()` call from `switchTab()`
- Remove `stripTuiChrome()` import and `strip-tui-chrome.js` module (only used by peek)

**styles.css:** Remove `#peek-panel` and related styles.

---

## 5. Tab Drag Handle Fix

### Remove text shift

Delete `transform: translateX(-2px)` from `.tab-entry:hover` in styles.css. The `::before` pseudo-element is already absolutely positioned — it doesn't affect text layout.

### Increase handle visibility

Change the existing `.tab-entry:hover::before` styles:
- `font-size: 8px` → `font-size: 14px`
- `opacity: 0.6` → remove (use color directly)
- `color` → `var(--overlay1)` (brighter than current)
- Adjust `left` position as needed for the larger size (`left: 1px`)

---

## 6. Topbar + Button Centering

Current `#topbar-new-tab` styles use `padding: 2px 6px` with `line-height: 1`, causing the nerd font glyph to sit off-center within the hover background.

**Fix:**
```css
#topbar-new-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
}
```

This centers the glyph within a fixed-size box, so the hover background is symmetrical.

---

## 7. Tab Rename Fix (Already Implemented)

For completeness — these changes are already staged:

- `focus()` and `select()` deferred via `requestAnimationFrame` after `replaceWith()`
- `mousedown` and `click` stopPropagation on the rename input to prevent the parent tab's click handler from triggering `switchTab` → `renderSidebar` → input destruction

---

## Testing Strategy

### Dangerous mode
- Test that `pty-manager.spawn()` appends `--dangerously-skip-permissions` when `options.dangerousMode` is true
- Test that the flag is NOT appended when false/undefined
- Test confirmation modal shows/hides correctly
- Test Escape key triggers normal launch
- Test setting toggle persists and swaps shortcut behavior

### Peek removal
- Verify no references to peek remain in app.js, index.html, styles.css
- Verify tab mouseenter/mouseleave only handle drag-related behavior

### CSS fixes
- Test that `.tab-entry:hover` does not have `transform` property
- Test that `#topbar-new-tab` has flex centering properties

### Tab rename
- Existing tests cover focus deferral and event propagation (already passing)
