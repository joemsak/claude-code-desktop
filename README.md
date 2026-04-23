# Claude Code Desktop

A native macOS terminal multiplexer for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Manage multiple Claude Code sessions in tabs, each rooted in a different project directory, with session persistence across restarts.

## Features

### Multi-tab terminal sessions

Open multiple Claude Code sessions side-by-side in a tabbed interface. Each tab spawns an independent terminal running `claude` in your chosen directory. Switch between tabs with **Cmd+1–9** or **Cmd+Shift+[** / **Cmd+Shift+]**.

### Welcome screen

On startup (with no open tabs), a welcome screen shows your recent workspaces for one-click access. Press **Cmd+T** or click "Browse" to open the workspace picker. Hold **Shift** to toggle between standard and skip-permissions mode — the welcome screen visually transforms to show which mode is active.

### Workspace picker

When you create a new tab (**Cmd+T**), a picker lists directories from `~/workspace/`. Your 5 most recently used workspaces appear at the top for quick access. Type to fuzzy-filter (e.g. "ccd" matches "claude-code-desktop"), use arrow keys to navigate, or click "Browse..." to open any directory on disk. Hold **Shift** while the picker is open to toggle between standard and dangerous mode.

Paste a git URL into the search to clone it into your workspace directory and open it automatically, or pick **Clone repo…** from the footer for a dedicated URL entry mode. If the target folder already exists, the existing workspace opens instead of re-cloning.

**Right-click** (or Cmd-click) a workspace row for "Remove from recents" / "Move to Trash". **Cmd+⌫** on the selected row trashes it directly. Trashed folders go to the system Trash (reversible).

### Session persistence

All open tabs, their directories, custom names, sidebar width, and window position are saved automatically when you quit. On next launch, everything is restored exactly as you left it. If a saved directory no longer exists, the tab falls back to your home directory and shows a warning indicator.

### Tab management

- **Rename tabs** — double-click a tab name to edit it inline
- **Reorder tabs** — drag tabs by the grip handle in the sidebar (powered by SortableJS with smooth animation)
- **Close tabs** — click the close button or press **Cmd+W**
- **Tooltips** — hover over a tab to see its full directory path

### Dangerous mode

Launch Claude with `--dangerously-skip-permissions` via **Cmd+Shift+T**. A confirmation modal always appears before launching in dangerous mode. Dangerous tabs are visually distinguished with an orange accent in the sidebar and topbar.

Toggle "Skip Permissions by Default" in Settings to swap the behavior — **Cmd+T** becomes dangerous mode and **Cmd+Shift+T** becomes standard mode. The confirmation modal still appears either way.

### Draggable top bar

The top bar displays the active tab's directory path and doubles as a window drag region.

### Resizable sidebar

Drag the sidebar edge to resize it between 120px and 400px. Your preferred width is persisted across sessions.

### Terminal

Full terminal emulation powered by xterm.js with 5000-line scrollback, cursor blinking, auto-fit on window resize, and truecolor (24-bit RGB) support. MesloLGS Nerd Font and JetBrainsMono Nerd Font are bundled for Powerline glyphs and devicons out of the box. When a session exits, press **Enter** to restart it in the same directory.

### Themes

5 built-in color themes: Catppuccin Mocha (default), Dracula, Nord, Tokyo Night, and Solarized Dark. Themes control both terminal ANSI colors and app chrome. Switch instantly from Settings (**Cmd+,**) — no restart needed.

Create custom themes by dropping a JSON file in `~/.config/claude-code-desktop/themes/`. Each theme defines `chrome` (app UI colors) and `terminal` (ANSI colors) sections.

### claude-devtools integration

If you have [claude-devtools](https://github.com/matt1398/claude-devtools) installed (`brew install --cask claude-devtools`), launch it from **View > Open Claude DevTools** or **Cmd+Shift+D**. It visualizes Claude Code session logs — every tool call, file path, and token.

### Settings

Press **Cmd+,** to open the settings panel. Configure your theme, terminal font family and size, workspace directory, and dangerous mode default.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| **Cmd+T** | New tab (or dangerous mode if default is flipped) |
| **Cmd+Shift+T** | New tab in opposite mode |
| **Cmd+W** | Close tab |
| **Cmd+,** | Settings |
| **Cmd+Shift+D** | Open Claude DevTools |
| **Cmd+1** – **Cmd+9** | Switch to tab 1–9 |
| **Cmd+Shift+[** | Previous tab |
| **Cmd+Shift+]** | Next tab |

## Install

### From GitHub Releases

Download the latest `.pkg` installer for your architecture (Apple Silicon or Intel) from the [Releases](https://github.com/joemsak/claude-code-desktop/releases) page. Since the app is not signed with an Apple Developer certificate, macOS will block the installer — go to **System Settings → Privacy & Security** and click **Open Anyway** to allow it.

### From source

Requires Node.js 22+ and the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed.

```bash
git clone https://github.com/joemsak/claude-code-desktop.git
cd claude-code-desktop
npm install
npm run start
```

To build and copy to `/Applications`:

```bash
npm run install-app
```

## Development

```bash
npm run dev       # bundle + launch (fast iteration)
npm run start     # rebuild native modules + bundle + launch
npm run test      # run tests
npm run lint      # run ESLint
npm run bundle    # bundle renderer JS only
```

Pre-commit hooks (via husky) automatically run lint, bundle, and tests before every commit — matching the CI pipeline.

## License

MIT
