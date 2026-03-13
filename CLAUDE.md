# CLAUDE.md

## Build/Run Commands
- `npm run dev` — bundle renderer and launch app (fast, skips native rebuild)
- `npm run start` — rebuild native modules + bundle + launch (use after npm install)
- `npm run bundle` — bundle renderer JS with esbuild
- `npm run rebuild` — rebuild node-pty for Electron
- `npm run test` — run test suite (vitest)
- `npm run dist` — build distributable .app and .dmg
- `npm run install-app` — build and copy to /Applications

## Releasing

**NEVER cut a release without user approval.** Committing code and releasing are separate actions. Do not run `npm run release:*` on your own initiative. You may recommend a release and ask the user if they're ready, but wait for confirmation before executing.

**How to release (only when asked):**
```bash
npm run release:patch   # bug fixes, small tweaks (1.0.0 → 1.0.1)
npm run release:minor   # new features (1.0.0 → 1.1.0)
npm run release:major   # breaking changes (1.0.0 → 2.0.0)
```

This bumps package.json, commits, tags, and pushes. GitHub Actions then builds DMGs for arm64 + x64 and publishes a GitHub Release automatically.

**Always run tests before releasing:** `npm test`

## Architecture
- Electron app: main process (src/main/), preload (src/preload/), renderer (src/renderer/)
- Renderer is bundled via esbuild (ESM → IIFE) to src/renderer/bundle.js
- xterm.css is copied from node_modules at bundle time
- node-pty must be rebuilt for Electron's Node version after npm install
- Session state persisted to ~/.config/claude-code-desktop/sessions.json

## Code Style
- Main process: CommonJS (require/module.exports)
- Renderer: ESM (import/export), bundled by esbuild
- Tests: ESM (.mjs files), vitest
- No framework — vanilla HTML/CSS/JS
- Colors defined in src/renderer/theme.js
- Modules use factory pattern (createStore, createManager) for testability
