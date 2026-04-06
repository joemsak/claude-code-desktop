# Theming & Nerd Fonts Design

**Date:** 2026-04-06
**Status:** Approved

## Overview

Add configurable themes (built-in presets + custom JSON themes) and Nerd Font support to claude-code-desktop. Themes control both terminal ANSI colors and app chrome colors via CSS custom properties. Nerd Fonts become the default terminal font with font family/size configurable in settings.

## Theme Data Shape

Every theme (built-in or custom) is a JSON object:

```json
{
  "name": "Catppuccin Mocha",
  "chrome": {
    "base": "#1e1e2e",
    "mantle": "#181825",
    "crust": "#11111b",
    "text": "#cdd6f4",
    "subtext0": "#585b70",
    "subtext1": "#6c7086",
    "surface0": "#313244",
    "surface1": "#45475a",
    "accent": "#89b4fa",
    "warning": "#f9e2af",
    "error": "#f38ba8"
  },
  "terminal": {
    "background": "#1e1e2e",
    "foreground": "#cdd6f4",
    "cursor": "#f5e0dc",
    "cursorAccent": "#1e1e2e",
    "selectionBackground": "#45475a",
    "selectionForeground": "#cdd6f4",
    "black": "#13181d",
    "red": "#b43c29",
    "green": "#00c100",
    "yellow": "#c7c400",
    "blue": "#2743c7",
    "magenta": "#bf3fbd",
    "cyan": "#00c5c7",
    "white": "#c7c7c7",
    "brightBlack": "#676767",
    "brightRed": "#dc7974",
    "brightGreen": "#57e690",
    "brightYellow": "#ece100",
    "brightBlue": "#a6aaf1",
    "brightMagenta": "#e07de0",
    "brightCyan": "#5ffdff",
    "brightWhite": "#feffff"
  }
}
```

The `chrome` keys map to CSS custom properties (`--base`, `--text`, etc.). The `terminal` keys are the xterm.js theme object passed directly.

## Built-in Themes

Ship 5 themes in `src/renderer/themes.js`:

1. **Catppuccin Mocha** (default) — current colors
2. **Dracula** — purple accent dark theme
3. **Nord** — muted blue-gray palette
4. **Tokyo Night** — deep blue/purple tones
5. **Solarized Dark** — warm, low-contrast classic

Each is a JS object matching the theme shape, exported as an array.

## Custom Themes

- Location: `~/.config/claude-code-desktop/themes/`
- Format: `.json` files matching the theme shape
- The `name` field inside the JSON is what appears in the dropdown
- Main process discovers them via `themes:list-custom` IPC channel
- Invalid JSON or missing required keys are silently skipped
- Custom themes appear below built-ins in the settings dropdown

## CSS Custom Properties

Replace all hardcoded colors in `styles.css` with CSS variables:

```css
body {
  background: var(--base);
  color: var(--text);
}
#sidebar {
  background: var(--mantle);
  border-right: 1px solid var(--surface0);
}
.tab-entry.active {
  border-left: 3px solid var(--accent);
}
```

Theme application sets properties on `document.documentElement.style`:

```js
document.documentElement.style.setProperty('--base', theme.chrome.base);
```

Theme switching is instant — no reload required. For terminals, `terminal.options.theme = theme.terminal` on each open tab.

## Font Configuration

- Default font: `"MesloLGS Nerd Font", Menlo, Monaco, "Courier New", monospace`
- Font family and font size are configurable in settings
- Persisted in `sessions.json` as `fontFamily` and `fontSize`
- On change, all open terminals get updated via `terminal.options.fontFamily` and `terminal.options.fontSize` followed by `fitAddon.fit()`
- Peek panel (`#peek-content`) also uses the configured font family via `var(--terminal-font)` CSS property

## Nerd Font Icons in App Chrome

Replace hardcoded Unicode characters with Nerd Font glyphs for select UI elements:

| Element | Current | New (Nerd Font) |
|---------|---------|-----------------|
| New tab button | `+` | `` (nf-cod-add) |
| Close button | `×` | `󰅖` (nf-md-close) |
| Tab drag handle | `\u2807` | `󰍜` (nf-md-menu) |

Icon elements use `.nf-icon { font-family: var(--terminal-font); }` to pull from the Nerd Font. Falls back to regular Unicode if the font doesn't have the glyphs.

## Settings UI Changes

Add to the existing settings modal (`#settings-body`):

1. **Theme** — `<select>` dropdown listing built-ins + custom themes. Selecting applies immediately (live preview).
2. **Font Family** — text input, defaults to the Nerd Font fallback chain.
3. **Font Size** — number input, defaults to 14.
4. **"Open Themes Folder"** button — opens `~/.config/claude-code-desktop/themes/` in Finder (creates directory if missing). Hint text: "Drop .json theme files here".

## Persistence

New keys in `sessions.json`:

```json
{
  "theme": "Catppuccin Mocha",
  "fontFamily": "\"MesloLGS Nerd Font\", Menlo, Monaco, \"Courier New\", monospace",
  "fontSize": 14
}
```

The `theme` value is the theme name string. On load, look up in built-ins first, then custom themes. Fall back to Catppuccin Mocha if not found.

## Files Changed

- **New:** `src/renderer/themes.js` — built-in theme definitions + theme application logic
- **Replace:** `src/renderer/theme.js` — removed, superseded by themes.js
- **Modified:** `src/renderer/styles.css` — all hardcoded colors replaced with CSS custom properties
- **Modified:** `src/renderer/app.js` — theme/font loading, settings UI additions, live theme switching
- **Modified:** `src/renderer/index.html` — new settings fields in modal HTML
- **Modified:** `src/main/main.js` — new IPC handlers for theme listing, themes folder operations
- **Modified:** `src/main/session-store.js` — new default keys for theme, fontFamily, fontSize
- **Modified:** `src/preload/preload.js` — new IPC bridge methods for theme operations
- **Modified:** `esbuild.config.js` — may need to include themes.js in bundle

## Testing

- Theme application: verify CSS variables are set on `:root` for each built-in theme
- Theme persistence: save/load theme name, font settings from session store
- Custom theme discovery: valid JSON loaded, invalid skipped
- Font changes: terminals resize correctly after font family/size change
- Live switching: theme changes apply to all open terminals without reload
- Fallback: unknown theme name falls back to Catppuccin Mocha
- Nerd Font icons: render correctly with Nerd Font, degrade gracefully without
