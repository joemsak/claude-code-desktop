# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- DevTools toggle (Cmd+Option+I) for debugging

### Fixed
- Fix terminal scrolling to top during long conversations by upgrading from `xterm` 5.3.0 to `@xterm/xterm` 5.5.0 and stripping ED3 erase-scrollback sequences from Claude's TUI repaint output
- DevTools shortcut (Cmd+Option+I) no longer captures keys globally — it now only works when the app window is focused

## [2.2.1] - 2026-04-01

### Fixed
- Clicking the "Follow" button now focuses the terminal, so you can immediately type or press keys without an extra click

## [2.2.0] - 2026-03-30

### Removed
- HTTP hooks system (hook server, hook config, settings.json hook injection) — was causing persistent hook errors in CLI sessions
- Native notifications (system alerts when Claude finishes or needs input)
- Status indicator dots (working/waiting states in sidebar, topbar, and peek panel)
- Tab close confirmation dialog — tabs now close immediately
- Hooks scope setting from settings UI

## [2.1.5] - 2026-03-28

### Fixed
- Hooks now properly uninstalled from settings files on app quit, preventing stale hook errors in CLI sessions

## [2.1.4] - 2026-03-28

### Fixed
- Hover peek now always scrolls to the bottom on hover

## [2.1.3] - 2026-03-28

### Fixed
- Directory picker horizontal scrolling caused by long paths (paths now truncate with ellipsis)
- Hover peek showing prompt box chrome, statusbar, and PR indicator lines (now truncates everything after Claude output)

## [2.1.2] - 2026-03-28

### Added
- Confirmation dialog when closing a tab with an active Claude session
- Confirmation dialog when quitting with active sessions running

## [2.1.1] - 2026-03-28

### Fixed
- Stale hooks left behind after app crash/restart now cleaned up on tab spawn
- Hook errors (PreToolUse, etc.) no longer occur when hook server from previous session is dead

### Changed
- Hover peek now omits Claude Code prompt area and statusbar (shows only meaningful output)
- Picker "Browse..." is now a sticky footer, always visible regardless of scroll position

## [2.1.0] - 2026-03-28

### Fixed
- Picker hover highlighting two items at once (section headers miscounted in selection index)
- Hover peek showing garbage text and escape sequences (now reads from xterm.js terminal buffer)
- Hover peek appearing after clicking a tab active (pending timeout now cancelled on switch)

### Changed
- Topbar now shows tab name, status dot, tab counter, and ~/shortened path
- Topbar reflects exited/warning state of active tab
- Active sidebar tab has blue left accent border
- Sidebar tabs have subtle separators for visual breathing room
- Sidebar tabs shift left on hover with micro-interaction
- Drag handle icon visible on tab hover for reorder discoverability
- Modal overlays (picker, settings) fade in smoothly
- Peek panel slides in from sidebar edge
- Status dots fade in with scale animation instead of popping
- Follow indicator has smooth background transition
- Buttons have refined hover scale and pressed states
- Distribution switched from DMG to PKG installer (auto-installs to /Applications)

## [2.0.1] - 2026-03-28

### Fixed
- ESLint `no-control-regex` CI failure — replaced regex literal with constructed RegExp to avoid lint suppression

### Added
- Pre-commit hooks via husky: runs lint, bundle, and tests before every commit (mirrors CI checks)

## [2.0.0] - 2026-03-28

### Added
- Settings UI (Cmd+,) with workspace directory and hooks scope configuration
- Hook-based Claude Code state detection via local HTTP server and Claude Code hooks API
- Sidebar status indicators: pulsing blue dot for working tabs, orange dot for tabs needing attention, dimmed strikethrough for exited tabs; idle tabs have no indicator (quiet by default)
- Hover peek: hover a sidebar tab for 500ms to preview the last 20 lines of terminal output in a floating panel
- Native macOS notifications when Claude finishes or needs input in a background tab (only when window is not focused)
- Empty state now shows recent workspaces directly, keyboard shortcut hints (Cmd+T, Cmd+,)
- Workspace picker section headers (Recent / All Workspaces) and directory paths alongside names

### Changed
- Closing the last tab returns to the empty state instead of quitting the app

## [1.5.0] - 2026-03-27

### Added
- Follow indicator at bottom-right of terminal: shows "Following ↓" (bold, white) when auto-scrolling with output, "Follow ↓" (muted) when user has scrolled up; click to jump back to bottom
- Tests for getCwd in pty-manager
- Tests for AWS auth module
- Tests for session save error reporting

### Removed
- Attention indicator feature (blue dot on background tabs)
- Broken scroll tracking bug fix code (atBottom flag, wheel-based scroll intent tracking, conditional scrollToBottom in onPtyData/switchTab/refitActiveTerminal) — replaced by xterm's native scroll behavior plus the follow indicator

### Fixed
- Command injection vulnerability in AWS profile name validation
- IPC input validation for paths, dimensions, and session data
- CWD polling interval now stops when no tabs are open
- Session save now reports success/failure status
- Explicit `script-src 'self'` in Content Security Policy

### Changed
- AWS auth extracted into configurable pre-spawn hook (aws-auth.js)
- Workspace directory is now configurable (defaults to ~/workspace)

## [1.4.1] - 2026-03-27

### Added
- Tab key autocompletes the selected item in workspace picker (instead of moving focus to other UI elements)

## [1.4.0] - 2026-03-18

### Fixed
- Attention indicator no longer falsely triggers on fresh tabs during startup (terminal auto-responses no longer count as user input)
- Attention indicator no longer clears when switching to the tab via keyboard shortcut (focus events from terminal no longer count as user input)

### Changed
- Attention indicator also triggers when app window loses focus during Claude output

### Added
- Fuzzy matching in workspace picker

## [1.3.2] - 2026-03-15

### Fixed
- Open OSC 8 hyperlinks in default browser without warning prompt
- Scroll stability during rapid terminal writes

### Added
- Cache AWS SSO auth per session and add Cmd+click links

## [1.3.1] - 2026-03-14

### Fixed
- Replace racy scroll snapshot with onScroll tracking, plus perf and DX improvements (#2)

## [1.3.0] - 2026-03-13

### Added
- Track working directory changes in tabs
- README with user-facing features and install instructions

### Fixed
- Restore scroll-to-bottom on PTY data writes
- Preserve terminal scroll position during refit and data writes

## [1.2.1] - 2026-03-12

### Added
- Draggable top bar showing active tab's directory path

### Fixed
- Terminal refit after first tab from empty state
- Terminal refit on new tab — double rAF for layout to settle

## [1.2.0] - 2026-03-11

### Added
- Empty state home screen with recent workspaces in picker
- Clean first launch — picker, escape fallback, replace home tab
- Show directory picker on first launch instead of home dir
- Auto AWS SSO login on launch

### Fixed
- Double-click tab name to rename now works
- save() merges with existing data to preserve recentWorkspaces
- load() with empty tabs no longer returns null
- Move AWS auth to main process, stop breaking PTY file descriptors
- Strip npm_ env vars to silence nvm warning, fix quit crash

## [1.1.3] - 2026-03-10

### Added
- Regression test for picker click-after-scroll fix

## [1.1.2] - 2026-03-09

### Fixed
- Match iTerm ANSI colors for readable status bar, fix picker click bug
- Opt into Node 24 for GitHub Actions to silence deprecation warnings

## [1.1.1] - 2026-03-08

### Fixed
- Use interactive login shell so claude is found in PATH
- Upgrade GitHub Actions to v5, drop Node 20 from CI

## [1.1.0] - 2026-03-07

### Added
- Release scripts and CLAUDE.md
- Install-app script and GitHub Releases workflow
- Test suite and GitHub Actions CI

### Fixed
- Packaging for macOS .app distribution

## [1.0.0] - 2026-03-06

### Added
- Initial implementation of Claude Code Desktop
- Multi-tab terminal sessions with xterm.js
- Workspace directory picker
- Session persistence across restarts
- Tab rename, reorder, and close
- Resizable sidebar
- Keyboard shortcuts (Cmd+T, Cmd+W, Cmd+1-9, Cmd+Shift+[/])
