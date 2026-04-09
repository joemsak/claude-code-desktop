# CLAUDE.md

## Git Workflow
- If the git user is `joemsak`, work directly on `main` — no feature branches needed.
- All other contributors should create feature branches and open PRs.

## Build/Run Commands
- `npm run dev` — bundle renderer and launch app (fast, skips native rebuild)
- `npm run start` — rebuild native modules + bundle + launch (use after npm install)
- `npm run bundle` — bundle renderer JS with esbuild
- `npm run rebuild` — rebuild node-pty for Electron
- `npm run test` — run test suite (vitest)
- `npm run lint` — run ESLint on src/ and test/
- `npm run dist` — build distributable .app and .pkg
- `npm run install-app` — build and copy to /Applications

## Pre-commit Hooks
- Husky runs lint, bundle, and tests before every commit (mirrors CI)
- Do not add `eslint-disable` comments — fix the underlying issue instead

## Releasing

**NEVER cut a release without user approval.** Committing code and releasing are separate actions. Do not run `npm run release:*` on your own initiative. You may recommend a release and ask the user if they're ready, but wait for confirmation before executing.

**How to release (only when asked):**
```bash
npm run release:patch   # bug fixes, small tweaks (1.0.0 → 1.0.1)
npm run release:minor   # new features (1.0.0 → 1.1.0)
npm run release:major   # breaking changes (1.0.0 → 2.0.0)
```

**Choosing the version:** If the release includes any new user-facing feature, it's a minor. If it's only bug fixes and polish (no new functionality), it's a patch. Major is reserved for breaking changes to session format, config, or CLI flags.

This bumps package.json, commits, tags, and pushes. GitHub Actions then builds PKG installers for arm64 + x64 and publishes a GitHub Release automatically.

**Always run tests before releasing:** `npm test`

**Before releasing:** Move the `[Unreleased]` section in CHANGELOG.md to a new version heading. Check if README needs updating to reflect what's shipping. If releasing from a feature branch, merge to main first.

## Architecture
- Electron app: main process (src/main/), preload (src/preload/), renderer (src/renderer/)
- Renderer is bundled via esbuild (ESM → IIFE) to src/renderer/bundle.js
- xterm.css is copied from node_modules at bundle time
- node-pty must be rebuilt for Electron's Node version after npm install
- Session state persisted to ~/.config/claude-code-desktop/sessions.json
- AWS auth is in `src/main/aws-auth.js` — a configurable pre-spawn hook
- Profile name is validated before shell interpolation
- `pty-manager.js` accepts a `preSpawnHook` parameter (third arg to `createManager`)

## Development Process
- Always use TDD — write failing tests first, then implement the minimum code to make them pass.
- After committing, update CHANGELOG.md under the `[Unreleased]` section.

## Electron Gotchas
- Never use `globalShortcut` for keyboard shortcuts — it captures keys system-wide, even when the app is not focused. Use `webContents.on("before-input-event")` or Electron `Menu` accelerators for window-local shortcuts instead.

## Code Style
- Main process: CommonJS (require/module.exports)
- Renderer: ESM (import/export), bundled by esbuild
- Tests: ESM (.mjs files), vitest
- No framework — vanilla HTML/CSS/JS
- Themes defined in src/renderer/themes.js (built-in presets + applyTheme)
- App chrome colors use CSS custom properties (set by themes.js at runtime)
- MesloLGS Nerd Font bundled in src/renderer/fonts/ via @font-face
- Modules use factory pattern (createStore, createManager) for testability
