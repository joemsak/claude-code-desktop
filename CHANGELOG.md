# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
