# Theming & Nerd Fonts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable themes (5 built-in presets + custom JSON themes) and Nerd Font support to claude-code-desktop.

**Architecture:** Replace all hardcoded colors in styles.css with CSS custom properties. Create a `themes.js` module with built-in theme definitions and an `applyTheme()` function that sets CSS vars on `:root` and updates xterm.js terminal themes. The main process discovers custom JSON themes from `~/.config/claude-code-desktop/themes/`. Settings UI gets theme dropdown, font family/size inputs, and an "Open Themes Folder" button. Font and theme preferences persist in `sessions.json`.

**Tech Stack:** Electron, xterm.js, CSS custom properties, vanilla JS, vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/renderer/themes.js` | Create | Built-in theme definitions, `applyTheme()`, `getThemeByName()` |
| `src/renderer/theme.js` | Delete | Replaced by themes.js |
| `src/renderer/styles.css` | Modify | Replace hardcoded colors with CSS custom properties |
| `src/renderer/index.html` | Modify | Add theme/font settings fields to settings modal |
| `src/renderer/app.js` | Modify | Theme/font loading, settings UI, live switching, Nerd Font icons |
| `src/main/main.js` | Modify | New IPC handlers: `themes:list-custom`, `themes:open-folder` |
| `src/main/session-store.js` | Modify | New defaults: `theme`, `fontFamily`, `fontSize` |
| `src/preload/preload.js` | Modify | New IPC bridge methods for theme operations |
| `test/themes.test.mjs` | Create | Tests for themes.js |
| `test/theme.test.mjs` | Modify | Update imports to use themes.js |
| `test/session-store.test.mjs` | Modify | Test new default keys |
| `test/settings-ui.test.mjs` | Modify | Test new IPC handlers in main.js |

---

### Task 1: Create themes.js with built-in themes

**Files:**
- Create: `src/renderer/themes.js`
- Create: `test/themes.test.mjs`

- [ ] **Step 1: Write the failing test for theme structure**

Create `test/themes.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { builtinThemes, getThemeByName, DEFAULT_THEME_NAME } from "../src/renderer/themes.js";

const REQUIRED_CHROME_KEYS = [
  "base", "mantle", "crust", "text", "subtext0", "subtext1",
  "surface0", "surface1", "accent", "warning", "error",
];

const REQUIRED_TERMINAL_KEYS = [
  "background", "foreground", "cursor", "cursorAccent",
  "selectionBackground", "selectionForeground",
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow",
  "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
];

describe("themes", () => {
  it("exports an array of 5 built-in themes", () => {
    expect(builtinThemes).toHaveLength(5);
  });

  it("each theme has a name, chrome, and terminal section", () => {
    for (const theme of builtinThemes) {
      expect(typeof theme.name).toBe("string");
      expect(theme.chrome).toBeDefined();
      expect(theme.terminal).toBeDefined();
    }
  });

  it("each theme has all required chrome keys as valid hex colors", () => {
    for (const theme of builtinThemes) {
      for (const key of REQUIRED_CHROME_KEYS) {
        expect(theme.chrome[key], `${theme.name} chrome.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("each theme has all required terminal keys as valid hex colors", () => {
    for (const theme of builtinThemes) {
      for (const key of REQUIRED_TERMINAL_KEYS) {
        expect(theme.terminal[key], `${theme.name} terminal.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("default theme name is Catppuccin Mocha", () => {
    expect(DEFAULT_THEME_NAME).toBe("Catppuccin Mocha");
  });

  it("getThemeByName returns the correct theme", () => {
    const theme = getThemeByName("Dracula");
    expect(theme).toBeDefined();
    expect(theme.name).toBe("Dracula");
  });

  it("getThemeByName returns Catppuccin Mocha for unknown name", () => {
    const theme = getThemeByName("nonexistent");
    expect(theme.name).toBe("Catppuccin Mocha");
  });

  it("includes Catppuccin Mocha, Dracula, Nord, Tokyo Night, Solarized Dark", () => {
    const names = builtinThemes.map((t) => t.name);
    expect(names).toContain("Catppuccin Mocha");
    expect(names).toContain("Dracula");
    expect(names).toContain("Nord");
    expect(names).toContain("Tokyo Night");
    expect(names).toContain("Solarized Dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/themes.test.mjs`
Expected: FAIL — module `../src/renderer/themes.js` not found

- [ ] **Step 3: Create themes.js with all 5 built-in themes**

Create `src/renderer/themes.js`:

```js
export const DEFAULT_THEME_NAME = "Catppuccin Mocha";

export const builtinThemes = [
  {
    name: "Catppuccin Mocha",
    chrome: {
      base: "#1e1e2e",
      mantle: "#181825",
      crust: "#11111b",
      text: "#cdd6f4",
      subtext0: "#585b70",
      subtext1: "#6c7086",
      surface0: "#313244",
      surface1: "#45475a",
      accent: "#89b4fa",
      warning: "#f9e2af",
      error: "#f38ba8",
    },
    terminal: {
      background: "#1e1e2e",
      foreground: "#cdd6f4",
      cursor: "#f5e0dc",
      cursorAccent: "#1e1e2e",
      selectionBackground: "#45475a",
      selectionForeground: "#cdd6f4",
      black: "#13181d",
      red: "#b43c29",
      green: "#00c100",
      yellow: "#c7c400",
      blue: "#2743c7",
      magenta: "#bf3fbd",
      cyan: "#00c5c7",
      white: "#c7c7c7",
      brightBlack: "#676767",
      brightRed: "#dc7974",
      brightGreen: "#57e690",
      brightYellow: "#ece100",
      brightBlue: "#a6aaf1",
      brightMagenta: "#e07de0",
      brightCyan: "#5ffdff",
      brightWhite: "#feffff",
    },
  },
  {
    name: "Dracula",
    chrome: {
      base: "#282a36",
      mantle: "#21222c",
      crust: "#191a21",
      text: "#f8f8f2",
      subtext0: "#6272a4",
      subtext1: "#7384b0",
      surface0: "#44475a",
      surface1: "#4d5066",
      accent: "#bd93f9",
      warning: "#f1fa8c",
      error: "#ff5555",
    },
    terminal: {
      background: "#282a36",
      foreground: "#f8f8f2",
      cursor: "#f8f8f2",
      cursorAccent: "#282a36",
      selectionBackground: "#44475a",
      selectionForeground: "#f8f8f2",
      black: "#21222c",
      red: "#ff5555",
      green: "#50fa7b",
      yellow: "#f1fa8c",
      blue: "#bd93f9",
      magenta: "#ff79c6",
      cyan: "#8be9fd",
      white: "#f8f8f2",
      brightBlack: "#6272a4",
      brightRed: "#ff6e6e",
      brightGreen: "#69ff94",
      brightYellow: "#ffffa5",
      brightBlue: "#d6acff",
      brightMagenta: "#ff92df",
      brightCyan: "#a4ffff",
      brightWhite: "#ffffff",
    },
  },
  {
    name: "Nord",
    chrome: {
      base: "#2e3440",
      mantle: "#272c36",
      crust: "#222730",
      text: "#eceff4",
      subtext0: "#7b88a1",
      subtext1: "#6c7a96",
      surface0: "#3b4252",
      surface1: "#434c5e",
      accent: "#88c0d0",
      warning: "#ebcb8b",
      error: "#bf616a",
    },
    terminal: {
      background: "#2e3440",
      foreground: "#eceff4",
      cursor: "#eceff4",
      cursorAccent: "#2e3440",
      selectionBackground: "#434c5e",
      selectionForeground: "#eceff4",
      black: "#3b4252",
      red: "#bf616a",
      green: "#a3be8c",
      yellow: "#ebcb8b",
      blue: "#81a1c1",
      magenta: "#b48ead",
      cyan: "#88c0d0",
      white: "#e5e9f0",
      brightBlack: "#4c566a",
      brightRed: "#bf616a",
      brightGreen: "#a3be8c",
      brightYellow: "#ebcb8b",
      brightBlue: "#81a1c1",
      brightMagenta: "#b48ead",
      brightCyan: "#8fbcbb",
      brightWhite: "#eceff4",
    },
  },
  {
    name: "Tokyo Night",
    chrome: {
      base: "#1a1b26",
      mantle: "#16161e",
      crust: "#131420",
      text: "#c0caf5",
      subtext0: "#565f89",
      subtext1: "#414868",
      surface0: "#292e42",
      surface1: "#33394e",
      accent: "#7aa2f7",
      warning: "#e0af68",
      error: "#f7768e",
    },
    terminal: {
      background: "#1a1b26",
      foreground: "#c0caf5",
      cursor: "#c0caf5",
      cursorAccent: "#1a1b26",
      selectionBackground: "#33394e",
      selectionForeground: "#c0caf5",
      black: "#15161e",
      red: "#f7768e",
      green: "#9ece6a",
      yellow: "#e0af68",
      blue: "#7aa2f7",
      magenta: "#bb9af7",
      cyan: "#7dcfff",
      white: "#a9b1d6",
      brightBlack: "#414868",
      brightRed: "#f7768e",
      brightGreen: "#9ece6a",
      brightYellow: "#e0af68",
      brightBlue: "#7aa2f7",
      brightMagenta: "#bb9af7",
      brightCyan: "#7dcfff",
      brightWhite: "#c0caf5",
    },
  },
  {
    name: "Solarized Dark",
    chrome: {
      base: "#002b36",
      mantle: "#00252f",
      crust: "#001f27",
      text: "#839496",
      subtext0: "#586e75",
      subtext1: "#657b83",
      surface0: "#073642",
      surface1: "#0a4050",
      accent: "#268bd2",
      warning: "#b58900",
      error: "#dc322f",
    },
    terminal: {
      background: "#002b36",
      foreground: "#839496",
      cursor: "#839496",
      cursorAccent: "#002b36",
      selectionBackground: "#073642",
      selectionForeground: "#93a1a1",
      black: "#073642",
      red: "#dc322f",
      green: "#859900",
      yellow: "#b58900",
      blue: "#268bd2",
      magenta: "#d33682",
      cyan: "#2aa198",
      white: "#eee8d5",
      brightBlack: "#002b36",
      brightRed: "#cb4b16",
      brightGreen: "#586e75",
      brightYellow: "#657b83",
      brightBlue: "#839496",
      brightMagenta: "#6c71c4",
      brightCyan: "#93a1a1",
      brightWhite: "#fdf6e3",
    },
  },
];

export function getThemeByName(name, customThemes = []) {
  const all = [...builtinThemes, ...customThemes];
  return all.find((t) => t.name === name) || builtinThemes[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/themes.test.mjs`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/themes.js test/themes.test.mjs
git commit -m "feat: add themes.js with 5 built-in theme presets"
```

---

### Task 2: Add applyTheme() and CSS custom property integration

**Files:**
- Modify: `src/renderer/themes.js`
- Modify: `test/themes.test.mjs`

- [ ] **Step 1: Write the failing test for applyTheme**

Append to `test/themes.test.mjs`:

```js
import { applyTheme } from "../src/renderer/themes.js";

describe("applyTheme", () => {
  it("sets CSS custom properties on the given element", () => {
    const el = document.createElement("div");
    const theme = getThemeByName("Catppuccin Mocha");
    applyTheme(theme, el);
    expect(el.style.getPropertyValue("--base")).toBe("#1e1e2e");
    expect(el.style.getPropertyValue("--text")).toBe("#cdd6f4");
    expect(el.style.getPropertyValue("--accent")).toBe("#89b4fa");
  });

  it("sets all chrome keys as CSS custom properties", () => {
    const el = document.createElement("div");
    const theme = getThemeByName("Dracula");
    applyTheme(theme, el);
    for (const key of REQUIRED_CHROME_KEYS) {
      expect(el.style.getPropertyValue(`--${key}`), `--${key}`).toBe(theme.chrome[key]);
    }
  });
});
```

Note: Move the `REQUIRED_CHROME_KEYS` constant above the first `describe` block so both describe blocks can reference it. Also add `applyTheme` to the import at the top.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/themes.test.mjs`
Expected: FAIL — `applyTheme` is not exported

- [ ] **Step 3: Implement applyTheme in themes.js**

Add to the bottom of `src/renderer/themes.js`:

```js
export function applyTheme(theme, rootElement = document.documentElement) {
  for (const [key, value] of Object.entries(theme.chrome)) {
    rootElement.style.setProperty(`--${key}`, value);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/themes.test.mjs`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/themes.js test/themes.test.mjs
git commit -m "feat: add applyTheme() for CSS custom property integration"
```

---

### Task 3: Replace hardcoded colors in styles.css with CSS custom properties

**Files:**
- Modify: `src/renderer/styles.css`

This task has no tests — it's a pure CSS refactor. The visual result is verified by running the app after Task 6 wires everything together.

- [ ] **Step 1: Replace all hardcoded color values in styles.css**

Apply the following replacements throughout `styles.css`. The mapping from hardcoded hex to CSS variable:

| Hex | CSS Variable | Role |
|-----|-------------|------|
| `#1e1e2e` | `var(--base)` | Background |
| `#181825` | `var(--mantle)` | Sidebar/header bg |
| `#11111b` | `var(--crust)` | Tab separator border |
| `#cdd6f4` | `var(--text)` | Primary text |
| `#585b70` | `var(--subtext0)` | Muted text |
| `#6c7086` | `var(--subtext1)` | Secondary text |
| `#313244` | `var(--surface0)` | Surface/border |
| `#45475a` | `var(--surface1)` | Hover surface |
| `#89b4fa` | `var(--accent)` | Blue accent |
| `#f9e2af` | `var(--warning)` | Yellow warning |
| `#f38ba8` | `var(--error)` | Red error |
| `#bac2de` | `var(--text)` | Tab hover text (close enough to text) |

Apply every replacement. There are ~60+ color references in styles.css. Every one of the hex values listed above gets replaced with its CSS variable equivalent.

Key areas to update:
- `body` (lines 8-14): `background`, `color`
- Topbar (lines 17-106): backgrounds, text colors, borders
- Sidebar (lines 113-317): backgrounds, text colors, borders, hover states
- Terminal container (lines 319-325): background
- Empty state (lines 327-442): backgrounds, text, borders, button styles
- Follow indicator (lines 444-474): colors
- Terminal wrapper (lines 476-490): no color changes needed
- Picker (lines 492-626): backgrounds, text, borders
- Peek panel (lines 628-685): backgrounds, text, borders
- Settings modal (lines 687-803): backgrounds, text, borders

Also add a `.nf-icon` utility class for Nerd Font icons:

```css
.nf-icon {
  font-family: var(--terminal-font);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/styles.css
git commit -m "refactor: replace hardcoded colors with CSS custom properties"
```

---

### Task 4: Update session-store with new default keys

**Files:**
- Modify: `src/main/session-store.js:10-18`
- Modify: `test/session-store.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add to the `DEFAULT_SESSION` describe block in `test/session-store.test.mjs`:

```js
  it("has default theme of Catppuccin Mocha", () => {
    expect(store.DEFAULT_SESSION.theme).toBe("Catppuccin Mocha");
  });

  it("has default fontFamily with Nerd Font", () => {
    expect(store.DEFAULT_SESSION.fontFamily).toContain("MesloLGS Nerd Font");
  });

  it("has default fontSize of 14", () => {
    expect(store.DEFAULT_SESSION.fontSize).toBe(14);
  });
```

Add a new test in the `load` describe block:

```js
  it("load returns saved theme and font settings", () => {
    const data = {
      version: 1,
      tabs: [],
      theme: "Dracula",
      fontFamily: "Fira Code",
      fontSize: 16,
    };
    fs.writeFileSync(sessionFile, JSON.stringify(data));
    const result = store.load();
    expect(result.theme).toBe("Dracula");
    expect(result.fontFamily).toBe("Fira Code");
    expect(result.fontSize).toBe(16);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/session-store.test.mjs`
Expected: FAIL — `store.DEFAULT_SESSION.theme` is undefined

- [ ] **Step 3: Add new defaults to session-store.js**

In `src/main/session-store.js`, update the `DEFAULT_SESSION` object (line 10-18):

```js
  const DEFAULT_SESSION = {
    version: 1,
    window: { x: undefined, y: undefined, width: 1200, height: 800 },
    sidebarWidth: 200,
    tabs: [],
    activeTabIndex: 0,
    recentWorkspaces: [],
    workspaceDir: path.join(home, "workspace"),
    theme: "Catppuccin Mocha",
    fontFamily: '"MesloLGS Nerd Font", Menlo, Monaco, "Courier New", monospace',
    fontSize: 14,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/session-store.test.mjs`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/session-store.js test/session-store.test.mjs
git commit -m "feat: add theme, fontFamily, fontSize defaults to session store"
```

---

### Task 5: Add IPC handlers and preload bridge for themes

**Files:**
- Modify: `src/main/main.js:183-199`
- Modify: `src/preload/preload.js`
- Modify: `test/settings-ui.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add to `test/settings-ui.test.mjs`:

```js
  it("has an IPC handler for listing custom themes", () => {
    expect(mainSource).toContain("themes:list-custom");
  });

  it("has an IPC handler for opening the themes folder", () => {
    expect(mainSource).toContain("themes:open-folder");
  });

  it("settings:load returns theme and font settings", () => {
    expect(mainSource).toContain("data.theme");
    expect(mainSource).toContain("data.fontFamily");
    expect(mainSource).toContain("data.fontSize");
  });

  it("settings:save handles theme and font settings", () => {
    expect(mainSource).toContain("settings.theme");
    expect(mainSource).toContain("settings.fontFamily");
    expect(mainSource).toContain("settings.fontSize");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/settings-ui.test.mjs`
Expected: FAIL — `themes:list-custom` not found in source

- [ ] **Step 3: Update settings:load in main.js**

Replace the `settings:load` handler (lines 184-190) in `src/main/main.js`:

```js
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

- [ ] **Step 4: Update settings:save in main.js**

Replace the `settings:save` handler (lines 192-199) in `src/main/main.js`:

```js
ipcMain.handle("settings:save", (_event, settings) => {
  if (!settings || typeof settings !== "object") return;
  const data = sessionStore.load() || sessionStore.DEFAULT_SESSION;
  if (typeof settings.workspaceDir === "string") {
    data.workspaceDir = settings.workspaceDir;
  }
  if (typeof settings.theme === "string") {
    data.theme = settings.theme;
  }
  if (typeof settings.fontFamily === "string") {
    data.fontFamily = settings.fontFamily;
  }
  if (typeof settings.fontSize === "number" && settings.fontSize >= 8 && settings.fontSize <= 32) {
    data.fontSize = settings.fontSize;
  }
  sessionStore.save(data);
});
```

- [ ] **Step 5: Add themes:list-custom handler to main.js**

Add after the `settings:save` handler in `src/main/main.js`:

```js
// IPC: Custom themes
ipcMain.handle("themes:list-custom", () => {
  const themesDir = path.join(
    os.homedir(),
    ".config",
    "claude-code-desktop",
    "themes",
  );
  try {
    if (!fs.existsSync(themesDir)) return [];
    const files = fs.readdirSync(themesDir).filter((f) => f.endsWith(".json"));
    const themes = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(themesDir, file), "utf-8");
        const theme = JSON.parse(content);
        if (theme.name && theme.chrome && theme.terminal) {
          themes.push(theme);
        }
      } catch {
        // Skip invalid theme files
      }
    }
    return themes;
  } catch {
    return [];
  }
});

ipcMain.handle("themes:open-folder", () => {
  const themesDir = path.join(
    os.homedir(),
    ".config",
    "claude-code-desktop",
    "themes",
  );
  fs.mkdirSync(themesDir, { recursive: true });
  shell.openPath(themesDir);
});
```

- [ ] **Step 6: Add preload bridge methods**

Add to the `electronAPI` object in `src/preload/preload.js`, after the existing Settings section:

```js
  // Themes
  listCustomThemes: () => ipcRenderer.invoke("themes:list-custom"),
  openThemesFolder: () => ipcRenderer.invoke("themes:open-folder"),
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- test/settings-ui.test.mjs`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/main/main.js src/preload/preload.js test/settings-ui.test.mjs
git commit -m "feat: add IPC handlers for theme/font settings and custom theme discovery"
```

---

### Task 6: Update settings modal HTML and app.js wiring

**Files:**
- Modify: `src/renderer/index.html:54-71`
- Modify: `src/renderer/app.js:3-4` (import), `app.js:36-39` (DOM refs), `app.js:325-339` (Terminal creation), `app.js:880-922` (settings)
- Delete: `src/renderer/theme.js`
- Modify: `test/theme.test.mjs`

- [ ] **Step 1: Update test/theme.test.mjs to import from themes.js**

Replace the entire file `test/theme.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { builtinThemes, getThemeByName } from "../src/renderer/themes.js";

describe("theme (legacy compatibility)", () => {
  it("Catppuccin Mocha terminal theme has correct background", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    expect(theme.terminal.background).toBe("#1e1e2e");
  });

  it("Catppuccin Mocha terminal theme has correct foreground", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    expect(theme.terminal.foreground).toBe("#cdd6f4");
  });

  it("Catppuccin Mocha terminal theme has cursor color", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    expect(theme.terminal.cursor).toBe("#f5e0dc");
  });

  it("Catppuccin Mocha terminal theme has selection color", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    expect(theme.terminal.selectionBackground).toBe("#45475a");
  });

  it("has all 8 ANSI colors as valid hex", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
    for (const color of colors) {
      expect(theme.terminal[color]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has all 8 bright ANSI colors as valid hex", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
    for (const color of colors) {
      const bright = "bright" + color.charAt(0).toUpperCase() + color.slice(1);
      expect(theme.terminal[bright]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
```

- [ ] **Step 2: Run the updated theme test to make sure it fails (theme.js still exists, but import is changed)**

Run: `npm test -- test/theme.test.mjs`
Expected: PASS (the import points to themes.js which exists from Task 1)

- [ ] **Step 3: Delete src/renderer/theme.js**

```bash
rm src/renderer/theme.js
```

- [ ] **Step 4: Update settings modal HTML in index.html**

Replace the settings modal `#settings-body` contents in `src/renderer/index.html` (lines 60-68):

```html
      <div id="settings-body">
        <div class="settings-group">
          <label class="settings-label">Theme</label>
          <p class="settings-hint">Color scheme for terminal and app chrome</p>
          <select id="settings-theme" class="settings-select"></select>
        </div>
        <div class="settings-group">
          <label class="settings-label">Font Family</label>
          <p class="settings-hint">Terminal font (Nerd Font recommended for icons)</p>
          <input id="settings-font-family" type="text" spellcheck="false" autocomplete="off" class="settings-input">
        </div>
        <div class="settings-group">
          <label class="settings-label">Font Size</label>
          <input id="settings-font-size" type="number" min="8" max="32" class="settings-input settings-input-narrow">
        </div>
        <div class="settings-group settings-separator"></div>
        <div class="settings-group">
          <label class="settings-label">Workspace Directory</label>
          <p class="settings-hint">Directory to scan for project folders in the workspace picker</p>
          <div class="settings-row">
            <input id="settings-workspace-dir" type="text" spellcheck="false" autocomplete="off">
            <button id="settings-browse-btn">Browse</button>
          </div>
        </div>
        <div class="settings-group">
          <label class="settings-label">Custom Themes</label>
          <p class="settings-hint">Drop .json theme files in the themes folder</p>
          <button id="settings-open-themes" class="settings-btn-secondary">Open Themes Folder</button>
        </div>
      </div>
```

- [ ] **Step 5: Add CSS for new settings elements**

Append to `src/renderer/styles.css`:

```css
.settings-select {
  width: 100%;
  background: var(--surface0);
  border: 1px solid var(--surface1);
  border-radius: 4px;
  padding: 8px 12px;
  color: var(--text);
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.settings-select:focus {
  border-color: var(--accent);
}

.settings-input {
  width: 100%;
  background: var(--surface0);
  border: 1px solid var(--surface1);
  border-radius: 4px;
  padding: 8px 12px;
  color: var(--text);
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  outline: none;
}

.settings-input:focus {
  border-color: var(--accent);
}

.settings-input-narrow {
  width: 80px;
}

.settings-separator {
  border-top: 1px solid var(--surface0);
  padding-top: 0;
  margin-bottom: 12px;
}

.settings-btn-secondary {
  background: var(--surface0);
  border: 1px solid var(--surface1);
  border-radius: 4px;
  padding: 8px 12px;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}

.settings-btn-secondary:hover {
  background: var(--surface1);
}
```

- [ ] **Step 6: Update app.js imports and DOM refs**

In `src/renderer/app.js`:

Replace line 3 (`import { terminalTheme } from "./theme.js";`):

```js
import { builtinThemes, getThemeByName, applyTheme, DEFAULT_THEME_NAME } from "./themes.js";
```

Add new DOM refs after line 39 (`const settingsBrowseBtn = ...`):

```js
const settingsThemeSelect = document.getElementById("settings-theme");
const settingsFontFamily = document.getElementById("settings-font-family");
const settingsFontSize = document.getElementById("settings-font-size");
const settingsOpenThemes = document.getElementById("settings-open-themes");
```

Add state variables after line 14 (`let homePath = "";`):

```js
let currentTheme = null;
let currentFontFamily = '"MesloLGS Nerd Font", Menlo, Monaco, "Courier New", monospace';
let currentFontSize = 14;
```

- [ ] **Step 7: Update Terminal creation to use theme state**

Replace the Terminal constructor in `createTab` (lines 327-338 of `src/renderer/app.js`):

```js
  const terminal = new Terminal({
    theme: currentTheme ? currentTheme.terminal : getThemeByName(DEFAULT_THEME_NAME).terminal,
    fontFamily: currentFontFamily,
    fontSize: currentFontSize,
    scrollback: 5000,
    cursorBlink: true,
    allowProposedApi: true,
    linkHandler: {
      activate: (_event, text, _range) => {
        electronAPI.openExternal(text);
      },
    },
  });
```

- [ ] **Step 8: Add theme/font application functions to app.js**

Add before the Settings section (before `async function openSettings()`):

```js
function applyThemeToAllTerminals(theme) {
  currentTheme = theme;
  applyTheme(theme);
  document.documentElement.style.setProperty("--terminal-font", currentFontFamily);
  for (const tab of tabs) {
    tab.terminal.options.theme = theme.terminal;
  }
}

function applyFontToAllTerminals() {
  document.documentElement.style.setProperty("--terminal-font", currentFontFamily);
  for (const tab of tabs) {
    tab.terminal.options.fontFamily = currentFontFamily;
    tab.terminal.options.fontSize = currentFontSize;
    tab.fitAddon.fit();
    electronAPI.resizePty(tab.id, tab.terminal.cols, tab.terminal.rows);
  }
}
```

- [ ] **Step 9: Update openSettings to load and display theme/font settings**

Replace the `openSettings` function in `src/renderer/app.js`:

```js
async function openSettings() {
  const settings = await electronAPI.loadSettings();
  settingsWorkspaceDir.value = settings.workspaceDir || "";

  // Populate theme dropdown
  const customThemes = await electronAPI.listCustomThemes();
  settingsThemeSelect.innerHTML = "";
  for (const theme of builtinThemes) {
    const opt = document.createElement("option");
    opt.value = theme.name;
    opt.textContent = theme.name;
    settingsThemeSelect.appendChild(opt);
  }
  if (customThemes.length > 0) {
    const sep = document.createElement("option");
    sep.disabled = true;
    sep.textContent = "--- Custom ---";
    settingsThemeSelect.appendChild(sep);
    for (const theme of customThemes) {
      const opt = document.createElement("option");
      opt.value = theme.name;
      opt.textContent = theme.name;
      settingsThemeSelect.appendChild(opt);
    }
  }
  settingsThemeSelect.value = settings.theme || DEFAULT_THEME_NAME;

  // Font settings
  settingsFontFamily.value = settings.fontFamily || currentFontFamily;
  settingsFontSize.value = settings.fontSize || currentFontSize;

  settingsOverlay.classList.remove("hidden");
  settingsThemeSelect.focus();
}
```

- [ ] **Step 10: Add event listeners for new settings fields**

Add after the existing `settingsBrowseBtn` event listener (after line 912):

```js
settingsThemeSelect.addEventListener("change", async () => {
  const name = settingsThemeSelect.value;
  const customThemes = await electronAPI.listCustomThemes();
  const theme = getThemeByName(name, customThemes);
  applyThemeToAllTerminals(theme);
  saveSettingsValue("theme", name);
});

settingsFontFamily.addEventListener("change", () => {
  currentFontFamily = settingsFontFamily.value;
  applyFontToAllTerminals();
  saveSettingsValue("fontFamily", currentFontFamily);
});

settingsFontSize.addEventListener("change", () => {
  const size = parseInt(settingsFontSize.value, 10);
  if (size >= 8 && size <= 32) {
    currentFontSize = size;
    applyFontToAllTerminals();
    saveSettingsValue("fontSize", size);
  }
});

settingsOpenThemes.addEventListener("click", () => {
  electronAPI.openThemesFolder();
});
```

- [ ] **Step 11: Apply saved theme on app startup**

Find the `init()` function (or the startup code at the bottom of app.js that calls `loadSessions`). Add theme/font initialization. Look for where `electronAPI.loadSessions()` is called and add before the tab creation loop:

```js
// Load theme and font settings on startup
const startupSettings = await electronAPI.loadSettings();
currentFontFamily = startupSettings.fontFamily || currentFontFamily;
currentFontSize = startupSettings.fontSize || currentFontSize;
const customThemes = await electronAPI.listCustomThemes();
currentTheme = getThemeByName(startupSettings.theme || DEFAULT_THEME_NAME, customThemes);
applyTheme(currentTheme);
document.documentElement.style.setProperty("--terminal-font", currentFontFamily);
```

- [ ] **Step 12: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 13: Commit**

```bash
git add src/renderer/app.js src/renderer/index.html src/renderer/styles.css test/theme.test.mjs
git rm src/renderer/theme.js
git commit -m "feat: wire up theme and font settings with live switching"
```

---

### Task 7: Nerd Font icons in app chrome

**Files:**
- Modify: `src/renderer/app.js` (close button, new tab button text)
- Modify: `src/renderer/index.html` (new tab buttons)

- [ ] **Step 1: Update new tab buttons in index.html**

In `src/renderer/index.html`, replace the new tab buttons:

Line 15 — topbar new tab button:
```html
    <button id="topbar-new-tab" class="nf-icon" title="New Tab (Cmd+T)">&#xea60;</button>
```

Line 20 — sidebar new tab button:
```html
      <button id="new-tab-btn" class="nf-icon" title="New Tab (Cmd+T)">&#xea60;</button>
```

- [ ] **Step 2: Update close button creation in app.js**

In `src/renderer/app.js`, find the close button creation (around line 199-201):

Replace:
```js
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.textContent = "\u00d7";
```

With:
```js
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn nf-icon";
    closeBtn.textContent = "\udb80\udd56";
```

Note: `\udb80\udd56` is the UTF-16 surrogate pair for the Nerd Font `nf-md-close` icon (U+F0156 `󰅖`).

- [ ] **Step 3: Update the drag handle CSS pseudo-element**

In `src/renderer/styles.css`, find the `.tab-entry:hover::before` rule (around line 189-198). Replace the content value:

```css
.tab-entry:hover::before {
  content: "\udb80\udf5c";
  font-family: var(--terminal-font);
  position: absolute;
  left: 3px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--surface1);
  font-size: 8px;
  opacity: 0.6;
  cursor: grab;
}
```

Note: `\udb80\udf5c` is the UTF-16 surrogate pair for `nf-md-menu` (U+F035C `󰍜`).

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Manually verify in the app**

Run: `npm run dev`

Check:
- New tab `+` buttons show the Nerd Font icon (or a reasonable fallback)
- Close `×` buttons show the Nerd Font icon
- Drag handles show the Nerd Font icon on hover

- [ ] **Step 6: Commit**

```bash
git add src/renderer/app.js src/renderer/index.html src/renderer/styles.css
git commit -m "feat: replace UI icons with Nerd Font glyphs"
```

---

### Task 8: Update BrowserWindow backgroundColor for theme consistency

**Files:**
- Modify: `src/main/main.js:27`

The `BrowserWindow` has a hardcoded `backgroundColor: "#1e1e2e"` which shows during initial load. This should match the user's saved theme.

- [ ] **Step 1: Update createWindow to use the saved theme's base color**

In `src/main/main.js`, update the `createWindow` function. Before the `BrowserWindow` creation, read the saved theme:

```js
function createWindow(sessionData) {
  const win = sessionData?.window || sessionStore.DEFAULT_SESSION.window;
  const bgColor = sessionData?.theme
    ? getBaseColorForTheme(sessionData.theme)
    : "#1e1e2e";

  mainWindow = new BrowserWindow({
    x: win.x,
    y: win.y,
    width: win.width || 1200,
    height: win.height || 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: bgColor,
```

Add a helper function before `createWindow` in `main.js`:

```js
// Map theme names to their base colors for BrowserWindow backgroundColor.
// This avoids importing the renderer's themes.js in the main process.
const THEME_BASE_COLORS = {
  "Catppuccin Mocha": "#1e1e2e",
  "Dracula": "#282a36",
  "Nord": "#2e3440",
  "Tokyo Night": "#1a1b26",
  "Solarized Dark": "#002b36",
};

function getBaseColorForTheme(themeName) {
  return THEME_BASE_COLORS[themeName] || "#1e1e2e";
}
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/main.js
git commit -m "feat: match BrowserWindow background to saved theme"
```

---

### Task 9: Final integration test and manual QA

**Files:**
- No new files

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All 151+ tests PASS

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Build the bundle**

Run: `npm run bundle`
Expected: Builds without errors

- [ ] **Step 4: Manual QA in the app**

Run: `npm run dev`

Verify:
1. App launches with Catppuccin Mocha theme (default)
2. Open Settings (Cmd+,) — theme dropdown shows 5 built-in themes
3. Switch to Dracula — all chrome colors change instantly, terminal colors change
4. Switch to Nord, Tokyo Night, Solarized Dark — all work
5. Font family input shows the Nerd Font default
6. Change font size to 18 — all terminals resize
7. "Open Themes Folder" button opens `~/.config/claude-code-desktop/themes/` in Finder
8. Quit and relaunch — theme and font settings persist
9. Nerd Font icons render in tab close buttons, new tab buttons, drag handles

- [ ] **Step 5: Commit any final fixes if needed**

If manual QA reveals issues, fix and commit each fix individually.
