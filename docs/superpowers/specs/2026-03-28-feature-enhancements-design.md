# Claude Code Desktop — Feature Enhancements Design

**Date:** 2026-03-28
**Status:** Draft

## Overview

A set of incremental enhancements to Claude Code Desktop focused on visibility into background tab activity, quality-of-life improvements, and UI polish. The core experience (spawning Claude sessions in workspace directories, managing them as tabs, terminal rendering/scrolling/input, session persistence) is unchanged.

All features are built incrementally with TDD. Each feature strengthens the app without altering existing workflows.

## Constraints

- Do not change how the terminal renders, scrolls, or handles input
- Do not change the tab/session lifecycle (spawn, manage, persist)
- Build slowly, incrementally, with TDD + refactor
- New features are additive — existing interactions stay the same

## Features

### 1. Close Last Tab Without Quitting

**Problem:** Closing the last tab forces a confirm dialog and quits the app. Users sometimes want to close all tabs and stay in the app.

**Design:**
- Remove the `confirm("Close the last tab and quit?")` dialog
- When the last tab is closed, destroy it and show the empty state (same as fresh launch with no tabs)
- User can open a new workspace from the empty state, or quit via Cmd+Q / window close button
- Session saves as empty (no tabs) so next launch shows the empty state
- No change to Cmd+W behavior — it still closes the active tab, just doesn't force quit when it's the last one

**Scope:** Small, isolated change in `closeTab()` in `src/renderer/app.js`.

### 2. Settings UI (Cmd+,)

**Problem:** No way to configure the app from within the app. Settings like workspace directory are buried in the session store JSON file.

**Design:**
- New keyboard shortcut: Cmd+, opens a settings window/panel
- Menu item under the app menu: "Settings..." with Cmd+, accelerator
- Clean, minimal UI matching the app's Catppuccin theme
- Initial settings:
  - **Workspace Directory** — text field + Browse button. Defaults to `~/workspace`. Saves to session store's `workspaceDir` field.
  - **Status Detection Hooks Scope** — toggle between "Per Project" (writes to `.claude/settings.local.json` in each workspace) and "Global" (writes to `~/.claude/settings.json`). Defaults to Per Project.
- Settings are persisted in the existing session store (`~/.config/claude-code-desktop/sessions.json`)
- Add more settings as features need them — keep it lean

**Implementation options:**
- Option A: Separate BrowserWindow (like a preferences window)
- Option B: In-app overlay/panel (similar to the picker)
- Recommendation: Option A (separate window) — conventional macOS pattern, doesn't obscure terminals

### 3. Hook-Based State Detection

**Problem:** Previous attention indicator attempts used timeout heuristics (2-second silence = "waiting for input") which produced false positives on idle tabs, startup output, and any pause in output. There is no reliable terminal signal — the `>` prompt is always visible regardless of Claude's state.

**Solution:** Use Claude Code's hooks API — real lifecycle events that fire at exact state transitions. Zero heuristics.

**Architecture:**
- Electron main process starts a lightweight HTTP server on a random localhost port at app launch
- When spawning a PTY, the app writes hook configuration to the workspace (or global settings, per user preference):
  - `UserPromptSubmit` → state becomes "working"
  - `PreToolUse` / `PostToolUse` → state stays "working" (resets idle timer if any)
  - `Stop` → state becomes "idle" (Claude finished, waiting for next input)
  - `Notification` (matcher: `idle_prompt`) → state becomes "waiting" (needs user attention)
- Each hook POSTs to `http://localhost:<port>/hooks` with `session_id` in the payload
- Main process maps `session_id` to tab ID and pushes state changes to renderer via IPC
- Cleanup: On tab close, the hook config entries added by the app are removed. On app quit, all are cleaned up.

**State machine per tab:**
```
spawning → idle → working → idle (loop)
                ↘ waiting (needs attention)
any state → exited (PTY exit)
```

**Hook configuration format** (written to `.claude/settings.local.json` in the workspace):
```json
{
  "hooks": {
    "Stop": [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://localhost:<port>/hooks" }] }],
    "UserPromptSubmit": [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://localhost:<port>/hooks" }] }],
    "PreToolUse": [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://localhost:<port>/hooks" }] }],
    "Notification": [{ "matcher": "idle_prompt", "hooks": [{ "type": "http", "url": "http://localhost:<port>/hooks" }] }]
  }
}
```

**Merging strategy:** Read existing settings file, merge hook entries. Our hooks are identifiable by a unique URL path segment (e.g., `http://localhost:<port>/hooks/ccd-<tabId>`). On cleanup, only remove entries whose URL matches our pattern. Never overwrite user's existing hooks.

**Session-to-tab mapping:** The hook URL includes the tab ID as a path segment (`/hooks/ccd-<tabId>`). When Claude POSTs to this URL, the HTTP server extracts the tab ID from the path. This avoids needing to correlate Claude's `session_id` with our tab IDs.

**Key lesson from previous attempt:** The old attention indicator (`de4f34c` through `7415a6b`) went through three iterations of heuristic fixes before being removed. Each fix introduced new edge cases. This hook-based approach avoids heuristics entirely.

### 4. Sidebar Status Indicators

**Problem:** When multiple tabs are open, there's no way to see what's happening in background tabs without switching to them.

**Design:**
- Status indicators appear only for notable states — idle tabs have no indicator (quiet by default)
- Visual hierarchy (most prominent to least):
  - **Needs attention** — orange dot (solid, `#fab387`) + tab name brightens to `#cdd6f4`
  - **Working** — pulsing blue dot (`#89b4fa`, CSS animation)
  - **Idle** — no indicator, standard dim tab styling (same as current)
  - **Exited** — dimmed text (`#585b70`) with strikethrough
- Dot is 6px, positioned left of the tab name with 8px gap
- No text labels ("working", "idle") — just the dots. The mockups showed labels for explanation purposes only.

**Depends on:** Feature 3 (Hook-Based State Detection)

### 5. Hover Peek (Output Preview)

**Problem:** Understanding what's happening in a background tab requires switching to it and reading/scrolling.

**Design:**
- Hover over a sidebar tab for ~500ms to show a floating peek panel
- Panel appears to the right of the sidebar, aligned with the hovered tab
- Shows the last ~20 lines of that tab's terminal output
- Header shows tab name + current status indicator
- Panel dismisses when mouse leaves the tab entry or the panel itself
- Content is plain text captured from PTY data (not a live terminal — just a text buffer)
- Monospace font matching the terminal (Menlo 11px)

**Implementation:**
- Each tab maintains a rolling buffer of the last ~20 lines of raw text output (strip ANSI escape codes for display)
- On hover, render the buffer into a positioned absolutely panel
- No interaction with the peek panel content (read-only preview)

### 6. Background Tab Notifications

**Problem:** When Claude finishes work or needs input in a background tab, the user has no way to know without checking.

**Design:**
- macOS native notifications via Electron's `Notification` API
- Fires when a background tab transitions to "needs attention" (Notification hook) or "idle" after a working period (Stop hook)
- Only fires when the app window is **not focused** (no notification spam while actively using the app)
- Notification content: tab name + last line of output as a snippet
- Clicking the notification focuses the app and switches to that tab
- Respects macOS notification settings (user can mute via System Settings)

**Depends on:** Feature 3 (Hook-Based State Detection)

### 7. UI/Theme Polish

Incremental visual refinements across the app. Each is a small, independent change.

#### 7a. Sidebar Refinement
- Directory path as a subtle second line under the tab name (font-size: 11px, color: `#585b70`)
- Better active/inactive contrast
- Tighter padding (8px vertical instead of 10px)

#### 7b. Empty State / Welcome Screen
- Show up to 3 recent workspaces directly on the landing page (clickable, opens that workspace)
- Keyboard shortcut hints (Cmd+T for picker, Cmd+, for settings)
- Subtle brand touch (icon or symbol)
- "Browse Other..." button instead of generic "Open Workspace"

#### 7c. Workspace Picker
- Section headers: "Recent" and "All Workspaces" (uppercase, small, dim)
- Directory paths shown alongside names (right-aligned, dim)
- Keep 400px width, use the space better with paths and headers
- Browse moved to bottom with subtle separator

#### 7d. Top Bar
- Add active tab's status indicator (dot) next to the path
- Subtle tab count when multiple tabs are open

#### 7e. Typography & Spacing
- Consistent font sizes across all UI elements
- Tighter vertical rhythm in sidebar
- Better spacing in picker items

#### 7f. Color Theme Refinement
- Review and improve contrast ratios for accessibility
- More intentional accent color usage (blue for interactive, orange for attention, green for success)
- No light theme — keep dark only

#### 7g. App Icon
- Design a new `.icns` icon for the app
- Terminal-inspired mark using the app's Catppuccin color palette
- Needs to work at all macOS icon sizes (16x16 through 1024x1024)
- Replace Electron's default icon in the build config
- Note: Requires an image design tool to produce the actual asset

## Build Order

Features are ordered by dependency and complexity. Each is a standalone increment.

1. **Close last tab without quitting** — smallest change, immediate UX win
2. **Settings UI (Cmd+,)** — infrastructure for configuring hooks scope
3. **UI/Theme polish** (7a-7g) — independent CSS/HTML changes, can be interleaved
4. **Hook-based state detection** — the foundation for status features
5. **Sidebar status indicators** — first consumer of state detection
6. **Hover peek** — independent of hooks (just needs PTY output buffer), but better with status in the header
7. **Background tab notifications** — wires hook states to Electron notifications

## Testing Strategy

- TDD throughout: write failing tests first, then implement
- Unit tests for state detection logic (hook event → state transition)
- Unit tests for output buffer (rolling window, ANSI stripping)
- Unit tests for settings persistence
- Integration tests for HTTP hook server (receives POST, maps to tab)
- Existing test patterns: vitest, ESM test files (.mjs), factory pattern for testability

## Architecture Notes

- HTTP hook server lives in `src/main/hook-server.js` (new file)
- Settings UI is a separate BrowserWindow with its own HTML/CSS
- Output buffer is a new module `src/main/output-buffer.js` or lives in renderer state
- All new main-process modules use the factory pattern (like `createManager`, `createStore`) for testability
- No new dependencies required — Node's built-in `http` module for the hook server, Electron's `Notification` API for notifications
