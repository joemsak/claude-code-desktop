# Claude Code Desktop - Design Spec

## Overview

A lightweight Electron desktop app for managing multiple Claude Code terminal sessions with persistent named tabs, session restore, and quick workspace directory switching.

## Problem

iTerm2 tabs all show "Claude code (docker)" because Claude Code sets the terminal title via escape codes. The `/rename` command doesn't stick. Managing multiple Claude Code sessions across different project directories is friction-heavy.

## Solution

A standalone macOS app with embedded terminal emulation (xterm.js) that fully controls tab naming and provides purpose-built session management for Claude Code.

## Technology Stack

- **Runtime**: Electron
- **Terminal emulation**: xterm.js + node-pty
- **UI**: HTML/CSS (no framework — the UI is simple enough)
- **Build**: electron-builder for packaging, @electron/rebuild for native modules
- **Bundler**: esbuild for renderer (xterm.js ships as ESM)
- **Language**: JavaScript (CommonJS for main process, ESM for renderer bundled via esbuild)

## Architecture

### Processes

- **Main process** — window management, PTY lifecycle (spawn/resize/kill via node-pty), session persistence (read/write JSON), IPC handlers
- **Preload script** — exposes a safe `electronAPI` bridge to the renderer via contextBridge (no nodeIntegration in renderer)
- **Renderer process** — tab sidebar UI, xterm.js terminal instances, directory picker overlay, keyboard shortcut handling

### Data Flow

```
Renderer (xterm.js) <--IPC--> Preload Bridge <--IPC--> Main (node-pty)
                                                         |
                                                    sessions.json
```

Each tab maps 1:1 to a node-pty instance, identified by a UUID assigned at creation time. Terminal data flows: PTY stdout -> IPC -> xterm.js `write()`, and xterm.js `onData` -> IPC -> PTY stdin.

### Tab Identity

Each tab gets a UUID (crypto.randomUUID()) at creation time. This ID is used for all IPC routing and is NOT persisted across restarts — new IDs are generated when sessions are restored.

### Preload API (electronAPI)

The preload script exposes these methods via contextBridge:

```js
electronAPI = {
  // PTY management
  spawnPty(tabId, directory)           // spawn claude in directory, returns void
  writePty(tabId, data)                // send keystrokes to PTY stdin
  resizePty(tabId, cols, rows)         // resize PTY
  killPty(tabId)                       // kill PTY process

  // PTY events (main -> renderer)
  onPtyData(callback(tabId, data))     // PTY stdout chunks
  onPtyExit(callback(tabId, exitCode)) // PTY process exited

  // Session persistence
  saveSessions(sessionData)            // write sessions.json
  loadSessions()                       // read sessions.json, returns object or null

  // Directory picker
  listWorkspaceDirs()                  // returns string[] of ~/workspace/ subdirs
  openDirectoryDialog()                // native folder picker, returns path or null
}
```

## Components

### Tab Sidebar (Left Panel)

- Fixed left panel, 200px wide by default, resizable via drag handle (min 120px, max 400px, width persisted in sessions.json)
- Long tab names are truncated with ellipsis; full name shown on hover tooltip
- Each tab entry shows the folder basename (e.g., `hawaiian-ice`)
- Active tab: highlighted background (`#313244`)
- Inactive tabs: muted text (`#6c7086`)
- Close button (x) appears on hover, right-aligned
- Drag to reorder vertically
- `+` button pinned at bottom of sidebar, opens directory picker
- Double-click a tab name to rename it inline (text input replaces the label, Enter confirms, Escape cancels)
- Tab naming rules:
  - Default name = `basename(workingDirectory)`
  - Duplicate default names get dynamically computed suffix: `hawaiian-ice`, `hawaiian-ice (2)`. Suffixes update when tabs are closed (e.g., if `hawaiian-ice` is closed, `hawaiian-ice (2)` becomes `hawaiian-ice`)
  - User-set custom names are preserved as-is (no dedup suffix)
  - Terminal title change escape sequences are **ignored** — name never changes from PTY output
  - Custom names survive session restore

### Terminal View

- xterm.js instance per tab, fills remaining window space (right of sidebar)
- Only active tab's terminal is visible; all others stay alive in background with PTY running
- Terminal auto-resizes on window resize (xterm.js `fit` addon)
- Each terminal spawns via node-pty: `shell: '/bin/zsh', args: ['-l', '-c', 'claude']` in the selected working directory. The login shell flag (`-l`) ensures PATH and environment variables (mise, nvm, etc.) are loaded correctly.
- Scrollback buffer: 5000 lines per terminal instance

### Directory Picker (Modal Overlay)

Triggered by Cmd+T or the `+` button.

- Semi-transparent dark overlay covers the window
- Centered modal (~400px wide, ~500px tall)
- **Search input** at top, auto-focused, filters list as you type
- **Directory list** below:
  - First item: `~ (Home)` — opens claude in `$HOME`
  - Then: all immediate subdirectories of `~/workspace/`, sorted alphabetically
  - Last item: `Browse...` — opens native macOS folder dialog
  - If `~/workspace/` does not exist, only `~ (Home)` and `Browse...` are shown
- Navigation: arrow keys to move selection, Enter to confirm, Escape to cancel
- Matching: case-insensitive substring match on directory name

### Session Persistence

- Config/state directory: `~/.config/claude-code-desktop/`
- Session file: `~/.config/claude-code-desktop/sessions.json`
- **On quit**: save current state:
  ```json
  {
    "version": 1,
    "window": { "x": 100, "y": 100, "width": 1200, "height": 800 },
    "sidebarWidth": 200,
    "tabs": [
      { "directory": "/Users/joseph.sak/workspace/hawaiian-ice", "customName": null },
      { "directory": "/Users/joseph.sak/workspace/zenpayroll", "customName": "my-payroll-work" }
    ],
    "activeTabIndex": 0
  }
  ```
- **On launch**: if sessions.json exists, restore window geometry, reopen each tab by spawning fresh `claude` in each directory. Active tab index is restored.
- **First launch** (no sessions file): opens one tab in `~`
- Terminal scrollback history is NOT persisted — each restore starts a fresh `claude` session
- **Autosave**: sessions.json is also written on tab open, close, reorder, and rename (debounced 1s) so state survives crashes
- Tab array order in JSON matches visual sidebar order (including any drag reordering)
- Display name is derived as: `customName ?? basename(directory)`. The `name` field is not stored — it's always computed from the directory path.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+T | New tab (opens directory picker) |
| Cmd+W | Close current tab. If last tab: native confirm dialog ("Close the last tab and quit?"). If confirmed, save session and quit. |
| Cmd+1 through Cmd+9 | Switch to tab N |
| Cmd+Shift+[ | Previous tab |
| Cmd+Shift+] | Next tab |

All other keyboard input passes through to the active terminal.

## Color Theme — "Dusk"

Inspired by Catppuccin Mocha, One Dark Pro, and Tokyo Night.

### Terminal Colors

| Color | Normal | Bright |
|-------|--------|--------|
| Background | `#1e1e2e` | — |
| Foreground | `#cdd6f4` | — |
| Cursor | `#f5e0dc` | — |
| Selection | `#45475a` | — |
| Black | `#45475a` | `#585b70` |
| Red | `#f38ba8` | `#f38ba8` |
| Green | `#a6e3a1` | `#a6e3a1` |
| Yellow | `#f9e2af` | `#f9e2af` |
| Blue | `#89b4fa` | `#89b4fa` |
| Magenta | `#cba6f7` | `#cba6f7` |
| Cyan | `#94e2d5` | `#94e2d5` |
| White | `#bac2de` | `#a6adc8` |

### App Chrome

| Element | Color |
|---------|-------|
| Sidebar background | `#181825` |
| Active tab background | `#313244` |
| Active tab text | `#cdd6f4` |
| Inactive tab text | `#6c7086` |
| Sidebar border (right) | `#313244` |
| Directory picker overlay | `rgba(0, 0, 0, 0.6)` |
| Directory picker modal bg | `#1e1e2e` |
| Directory picker input bg | `#313244` |
| Directory picker hover | `#45475a` |
| `+` button | `#6c7086`, hover: `#cdd6f4` |

### Font

- Terminal: `Menlo, Monaco, 'Courier New', monospace` at 14px
- Sidebar: system font (`-apple-system`) at 13px

## File Structure

```
claude-code-desktop/
  package.json
  src/
    main/
      main.js          # Electron main process, window creation, IPC
      pty-manager.js    # node-pty lifecycle (spawn, write, resize, kill)
      session-store.js  # Read/write sessions.json
    preload/
      preload.js        # contextBridge API
    renderer/
      index.html        # App shell
      styles.css         # All styles
      app.js            # Tab management, terminal creation, directory picker
      theme.js          # Color theme constants
```

## Error Handling

- If `claude` command not found: show a message in the terminal area with install instructions
- If PTY exits (claude session ends): show "[Session ended. Press Enter to restart or Cmd+W to close]" in the terminal. Restart spawns a new `claude` in the same directory, preserving the tab name. Scrollback is cleared on restart.
- If sessions.json is corrupted: start fresh with one tab in `~`
- If a restored directory no longer exists: open that tab in `~` instead, keep the original name with a warning indicator

## Out of Scope (v1)

- Multiple color themes / theme switching
- Font size configuration UI (can edit config file manually)
- Split panes
- Auto-updates
- Linux/Windows support
