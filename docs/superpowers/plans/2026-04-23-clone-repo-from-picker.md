# Clone Repo from Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "clone a new git repo" action to the workspace picker. Two entry points (URL paste + "Clone repo…" footer) converge on a PTY that runs `git clone` in the configured workspace dir; on exit 0 the tab auto-respawns as a Claude session in the cloned repo; on failure the tab shows a retry banner.

**Architecture:** Extend `pty-manager.spawn` to accept a `{ command: { type: "git-clone", url, name } }` option that bypasses the Claude launcher. Validation + URL parsing live in a single pure module `src/main/git-url.js` used by both IPC handlers. Renderer's picker gains a synthetic "clone match" when the search box contains a URL, plus a footer action that flips the search input into "Git URL" entry mode. Renderer orchestration respawns the PTY in the cloned directory after success.

**Tech Stack:** Electron (main + preload + renderer), vanilla JS, esbuild bundle, vitest, node-pty.

Spec: `docs/superpowers/specs/2026-04-23-clone-repo-from-picker-design.md`

---

## File plan

**Create:**
- `src/main/git-url.js` — pure URL parser/validator
- `test/git-url.test.mjs`
- `test/pty-manager-custom-command.test.mjs`
- `test/git-clone-ipc.test.mjs`
- `test/picker-clone-url-detect.test.mjs`
- `test/picker-clone-footer.test.mjs`
- `test/clone-retry-banner.test.mjs`

**Modify:**
- `src/main/pty-manager.js`
- `src/main/main.js`
- `src/preload/preload.js`
- `src/renderer/picker.js`
- `src/renderer/app.js`
- `src/renderer/styles.css`
- `src/renderer/index.html`
- `CHANGELOG.md`

---

## Task 1 — Git URL parser (`git-url.js`)

**Files:** Create `src/main/git-url.js`, `test/git-url.test.mjs`

- [ ] **Step 1a:** Write failing tests covering: SSH form, HTTPS form, ssh:// form, bare `owner/repo` shorthand, trailing `.git` handling, name extraction, and rejection of bad inputs (empty, file://, javascript:, embedded spaces, path traversal).

- [ ] **Step 1b:** Implement `parseGitUrl(input)` returning `{ valid, url, name, reason? }`:
  - Trim whitespace; reject empty or whitespace-only.
  - Recognize SSH `git@host:owner/repo(.git)?`, HTTPS `https?://host/.../repo(.git)?`, ssh:// `ssh://...`, and shorthand `owner/repo` → expanded to `https://github.com/owner/repo.git`.
  - Extract `name` = last path segment with `.git` stripped.
  - Reject if `name` contains `/`, `\`, `..`, NUL, or is > 255 chars, or empty.
  - Reject other schemes (`file:`, `javascript:`, `data:`, etc.).

- [ ] **Step 1c:** Run `npm test -- git-url` — expect PASS.

- [ ] **Step 1d:** Commit.

## Task 2 — pty-manager accepts custom `command`

**Files:** Modify `src/main/pty-manager.js`, create `test/pty-manager-custom-command.test.mjs`

- [ ] **Step 2a:** Write failing tests: when `options.command = { type: "git-clone", url, name }`, `spawn` calls `ptyLib.spawn("git", ["clone", url, name], { cwd, env, ... })`, does **not** invoke the AWS pre-spawn hook, and still forwards data/exit callbacks with the tab id.

- [ ] **Step 2b:** Modify `spawn` in `src/main/pty-manager.js` to branch on `options.command`. When `command.type === "git-clone"`, skip `onPreSpawn`, skip the shell wrapping, and spawn `git` directly with args `["clone", command.url, command.name]`. All other existing callers unaffected.

- [ ] **Step 2c:** Run `npm test -- pty-manager` — expect PASS (both new and existing tests).

- [ ] **Step 2d:** Commit.

## Task 3 — IPC handlers (`git:parse-url`, `git:clone`)

**Files:** Modify `src/main/main.js`, create `test/git-clone-ipc.test.mjs`

- [ ] **Step 3a:** Write failing tests: extract the handler bodies into small factory functions (`createGitCloneHandler`, `createGitParseUrlHandler`) parameterized by a `ptyManager` and a `getWorkspaceDir` dependency so we can unit-test them. Tests assert:
  - `parse-url` returns `{ valid: true, name, url }` for a good URL and `{ valid: false }` for a bad one.
  - `git:clone` with a valid URL calls `ptyManager.spawn(tabId, workspaceDir, onData, onExit, { dangerousMode, command: { type: "git-clone", ... } })` and returns `{ ok: true, name, path }`.
  - `git:clone` with an invalid URL returns `{ ok: false, error }` and does **not** call `ptyManager.spawn`.

- [ ] **Step 3b:** Implement the handlers in `src/main/main.js`. Extract the handler factories so both the production wiring and tests share one source of truth. Wire `ipcMain.handle("git:parse-url", ...)` and `ipcMain.handle("git:clone", ...)`.

- [ ] **Step 3c:** Run `npm test` — expect PASS.

- [ ] **Step 3d:** Commit.

## Task 4 — Preload exposure

**Files:** Modify `src/preload/preload.js`

- [ ] **Step 4a:** Add:

```js
parseGitUrl: (url) => ipcRenderer.invoke("git:parse-url", url),
cloneRepo: ({ tabId, url, dangerousMode }) =>
  ipcRenderer.invoke("git:clone", { tabId, url, dangerousMode }),
```

- [ ] **Step 4b:** Run `npm run lint && npm run bundle && npm test` — expect PASS.

- [ ] **Step 4c:** Commit.

## Task 5 — Picker: synthetic clone match from search URL

**Files:** Modify `src/renderer/picker.js`, create `test/picker-clone-url-detect.test.mjs`

- [ ] **Step 5a:** Write failing source-level tests asserting:
  - When the picker search contains a valid git URL, `renderList` produces a list whose first item has class `picker-clone` and text like `Clone <name> into ~/workspace`.
  - When the search is a non-URL, no `picker-clone` row appears.

  Follow the pattern of `picker-click-fix.test.mjs` — spin up a JSDOM environment with the picker DOM, import `createPicker`, pass a fake `electronAPI.parseGitUrl`, and assert on rendered DOM.

- [ ] **Step 5b:** Modify `src/renderer/picker.js`:
  - Add internal `cloneCandidate` state, refreshed when the search input changes. Use `await electronAPI.parseGitUrl(value)`; debounce is not required for MVP (IPC is cheap).
  - In `getFilteredDirs`, when `cloneCandidate` is present, prepend a synthetic item `{ isClone: true, url, name }`.
  - In `renderList`, render a `picker-clone` `<li>` that reads `⎘  Clone <name> into ~/workspace` (the literal word "workspace" — we don't read settings here; tooltip could say the real path but keep it simple).
  - In `selectItem`, when `dir.isClone`, close the picker and call a new callback `onClone(url)` (added to the factory options).

- [ ] **Step 5c:** Run `npm test -- picker` — expect PASS.

- [ ] **Step 5d:** Commit.

## Task 6 — Picker: "Clone repo…" footer + URL entry mode

**Files:** Modify `src/renderer/picker.js`, `src/renderer/index.html`, `src/renderer/styles.css`, create `test/picker-clone-footer.test.mjs`

- [ ] **Step 6a:** Write failing tests:
  - The picker modal contains a second footer row `#picker-clone-footer` with text "Clone repo…".
  - Activating it (click) puts the picker in URL-entry mode: search input has attribute `data-mode="url"`, placeholder reads `Paste a git URL and press Enter`, list is empty.
  - Pressing Escape while in URL-entry mode restores `data-mode="normal"` and re-renders the list.
  - Pressing Enter in URL-entry mode with a valid URL calls `onClone(url)`; with an invalid URL shows an error element with text `Not a valid git URL` and does **not** call `onClone`.

- [ ] **Step 6b:** Implement:
  - `index.html`: no change needed if the footer is created dynamically by `picker.js` (the existing "Browse…" footer is created dynamically too).
  - `picker.js`: render both footer rows. Maintain a `mode` state (`"normal"` or `"url"`). Add `enterUrlMode()` / `exitUrlMode()`. In URL mode, Enter calls `parseGitUrl` — if valid, call `onClone`; if not, set the inline error.
  - `styles.css`: styling for `#picker-clone-footer`, URL-mode input appearance, error message.

- [ ] **Step 6c:** Run `npm test -- picker` and `npm run lint` — expect PASS.

- [ ] **Step 6d:** Commit.

## Task 7 — Renderer orchestration (clone tab lifecycle)

**Files:** Modify `src/renderer/app.js`, `src/renderer/styles.css`, create `test/clone-retry-banner.test.mjs`

- [ ] **Step 7a:** Write failing tests for a pure orchestrator extracted from `app.js`:
  - Expose a `createCloneOrchestrator({ electronAPI, createTab, respawnInDir, trackWorkspace, renderRetryBanner })` factory in a new `src/renderer/clone-flow.js`.
  - Test: `clone(url, { dangerousMode })` calls `createTab` with no PTY (a "cloning" tab), invokes `electronAPI.cloneRepo` with the returned `tabId`, and stores the promised result.
  - Test: when the orchestrator's `onExit(tabId, 0)` fires, it calls `respawnInDir(tabId, clonedPath, { dangerousMode })` and `trackWorkspace(clonedPath)`.
  - Test: when `onExit(tabId, 1)` fires, it calls `renderRetryBanner(tabId, retryFn, closeFn)`.
  - Test: invoking the retry function reinvokes `electronAPI.cloneRepo` with the same args.

- [ ] **Step 7b:** Implement `src/renderer/clone-flow.js` and wire it into `app.js`:
  - Add a `createTab` variant (or a parameter flag) that skips `electronAPI.spawnPty` — e.g., `createTab(directory, customName, originalDir, { dangerousMode, skipSpawn })`.
  - Add a `respawnInDir(tabId, newDir, { dangerousMode })` helper that updates the tab's `directory`, calls `electronAPI.spawnPty`, clears the terminal, re-renders sidebar/topbar.
  - Add `renderRetryBanner(tabId, retryFn, closeFn)` which attaches a banner DOM element inside `tab.wrapper` with Retry and Close buttons.
  - In the existing `onPtyExit` handler, route to the clone orchestrator when the tab is in "cloning" state; otherwise keep current behavior.
  - Wire `picker.onClone(url)` to `orchestrator.clone(url, { dangerousMode: isEffectiveDangerous() })`.

- [ ] **Step 7c:** Add styles in `styles.css` for the retry banner (`.clone-retry-banner`), positioned at top of `.terminal-wrapper`.

- [ ] **Step 7d:** Run `npm test && npm run lint && npm run bundle` — expect PASS.

- [ ] **Step 7e:** Commit.

## Task 8 — CHANGELOG

**Files:** Modify `CHANGELOG.md`

- [ ] **Step 8a:** Add an `[Unreleased]` entry:

  ```markdown
  ### Added
  - Clone a git repo from the workspace picker. Paste a git URL into the picker search, or pick the new "Clone repo…" footer action. Clones into the configured workspace directory and auto-opens the repo on success; shows Retry / Close on failure.
  ```

- [ ] **Step 8b:** Commit.

## Task 9 — End-to-end manual verification

- [ ] **Step 9a:** Run `npm run dev`. In the picker, paste `git@github.com:joemsak/claude-code-desktop.git` (or similar). Verify the synthetic "Clone claude-code-desktop into ~/workspace" row appears at the top. Cancel with Escape (we don't want to actually re-clone this repo).

- [ ] **Step 9b:** In the picker, trigger "Clone repo…" footer → URL-entry mode. Paste a bad URL → verify inline error. Press Escape → normal mode. Paste a real URL → verify new tab opens and clones. On exit 0 verify the tab respawns in the cloned repo (Claude launches).

- [ ] **Step 9c:** Force a failure: paste a URL that will fail (non-existent repo). Verify retry banner appears.

- [ ] **Step 9d:** Report results.
