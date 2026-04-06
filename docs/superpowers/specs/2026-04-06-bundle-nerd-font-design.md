# Bundle Nerd Font in App Design

**Date:** 2026-04-06
**Status:** Approved

## Overview

Bundle MesloLGS Nerd Font `.ttf` files in the app so the default terminal font works out of the box without a system install.

## Font Files

Include 4 variants in `src/renderer/fonts/`:
- `MesloLGS-NF-Regular.ttf`
- `MesloLGS-NF-Bold.ttf`
- `MesloLGS-NF-Italic.ttf`
- `MesloLGS-NF-BoldItalic.ttf`

## CSS @font-face

Add to `src/renderer/styles.css`:

```css
@font-face {
  font-family: "MesloLGS Nerd Font";
  src: url("fonts/MesloLGS-NF-Regular.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: "MesloLGS Nerd Font";
  src: url("fonts/MesloLGS-NF-Bold.ttf") format("truetype");
  font-weight: bold;
  font-style: normal;
}

@font-face {
  font-family: "MesloLGS Nerd Font";
  src: url("fonts/MesloLGS-NF-Italic.ttf") format("truetype");
  font-weight: normal;
  font-style: italic;
}

@font-face {
  font-family: "MesloLGS Nerd Font";
  src: url("fonts/MesloLGS-NF-BoldItalic.ttf") format("truetype");
  font-weight: bold;
  font-style: italic;
}
```

## Build

Update `esbuild.config.js` to copy font files from `src/renderer/fonts/` to the output location during build (same pattern as the existing xterm.css copy).

## CSP

Already allowed — `font-src 'self'` in index.html.

## Files Changed

- Add: `src/renderer/fonts/MesloLGS-NF-Regular.ttf`
- Add: `src/renderer/fonts/MesloLGS-NF-Bold.ttf`
- Add: `src/renderer/fonts/MesloLGS-NF-Italic.ttf`
- Add: `src/renderer/fonts/MesloLGS-NF-BoldItalic.ttf`
- Modify: `src/renderer/styles.css` (add @font-face rules)
- Modify: `esbuild.config.js` (copy font files during build)

## No Changes To

themes.js, app.js, session-store, IPC handlers, settings UI. The font is already the default — this just makes it available without a system install.
