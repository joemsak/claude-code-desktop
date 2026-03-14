# Claude Code Desktop

A native macOS terminal multiplexer for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Manage multiple Claude Code sessions in tabs, each rooted in a different project directory, with session persistence across restarts.

## Features

### Multi-tab terminal sessions

Open multiple Claude Code sessions side-by-side in a tabbed interface. Each tab spawns an independent terminal running `claude` in your chosen directory. Switch between tabs with **Cmd+1–9** or **Cmd+Shift+[** / **Cmd+Shift+]**.

### Workspace picker

When you create a new tab (**Cmd+T**), a picker lists directories from `~/workspace/`. Your 5 most recently used workspaces appear at the top for quick access. Type to filter, use arrow keys to navigate, or click "Browse..." to open any directory on disk.

### Session persistence

All open tabs, their directories, custom names, sidebar width, and window position are saved automatically when you quit. On next launch, everything is restored exactly as you left it. If a saved directory no longer exists, the tab falls back to your home directory and shows a warning indicator.

### Tab management

- **Rename tabs** — double-click a tab name to edit it inline
- **Reorder tabs** — drag and drop tabs in the sidebar
- **Close tabs** — click the close button or press **Cmd+W**
- **Tooltips** — hover over a tab to see its full directory path

### Draggable top bar

The top bar displays the active tab's directory path and doubles as a window drag region. The new-tab button sits in the top-right corner for quick access.

### Resizable sidebar

Drag the sidebar edge to resize it between 120px and 400px. Your preferred width is persisted across sessions.

### Terminal

Full terminal emulation powered by xterm.js with a Catppuccin Dusk color theme, 5000-line scrollback, cursor blinking, and auto-fit on window resize. When a session exits, press **Enter** to restart it in the same directory.

### AWS SSO auto-login

On launch, the app checks your AWS credentials and automatically runs `aws sso login` if needed (using the `AWS_PROFILE` env var or defaulting to `bedrock-users`). This runs in the background and never blocks startup.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| **Cmd+T** | New tab |
| **Cmd+W** | Close tab |
| **Cmd+1** – **Cmd+9** | Switch to tab 1–9 |
| **Cmd+Shift+[** | Previous tab |
| **Cmd+Shift+]** | Next tab |

## Install

### From GitHub Releases

Download the latest `.dmg` for your architecture (Apple Silicon or Intel) from the [Releases](https://github.com/joemsak/claude-code-desktop/releases) page.

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
npm run bundle    # bundle renderer JS only
```

## License

MIT
