# Clone a Git Repo from the Workspace Picker

**Status:** Approved
**Date:** 2026-04-23

## Overview

Add the ability to clone a new git repository from the workspace picker. The clone targets the configured workspace directory (default `~/workspace`). Once the clone finishes successfully, the cloned repo is opened in the same tab using the existing Claude launcher — no extra click required.

## Goals

- Make cloning a new repo a keyboard-first, picker-native action.
- Handle interactive auth prompts (SSH passphrase, HTTPS password, host-key confirmation) naturally, using the existing PTY.
- Detect clone success/failure from the process exit code — no terminal-output parsing.
- Keep the change minimal: extend the existing picker and pty-manager rather than introducing a parallel clone UI.

## Non-goals

- Branch selection at clone time (`--branch`).
- SSH key management or credential helpers.
- Shallow/partial clones.
- A live progress bar or structured progress parsing.
- Cloning into an arbitrary directory (we always use the configured `workspaceDir`).

## User experience

Two entry points converge on the same flow:

### Path 1 — paste a git URL into the picker search

The picker's search input is a fuzzy filter today. When the current input looks like a git URL, the picker injects a synthetic match pinned to the top of the list:

```
⎘  Clone <repo-name> into ~/workspace
```

Pressing Enter (or clicking) starts the clone.

**Accepted URL shapes:**

- `git@host:owner/repo(.git)?`
- `https://host/owner/repo(.git)?`
- `ssh://...`
- Bare shorthand `owner/repo` — expanded to `https://github.com/owner/repo.git`

### Path 2 — "Clone repo…" footer action

A second footer row next to "Browse…" reads **"Clone repo…"**. Activating it (click or Enter when selected) transforms the picker into a URL-entry mode:

- Search input label changes to `Git URL:`
- Placeholder reads `Paste a git URL and press Enter`
- List area clears
- Escape returns to the normal picker

Enter kicks off the clone. If the input is not a valid git URL, an inline error `Not a valid git URL` appears beneath the input.

### Folder naming

The target folder name is auto-derived from the URL: strip a trailing `.git`, take the last path segment. No override UI. Renaming post-clone is trivial if the user wants something else.

### Clone execution

- Picker closes.
- A new tab is created with the dangerous-mode flag that was active in the picker.
- The tab's PTY spawns `git clone <url> <name>` directly (not inside a shell) with `cwd = <workspaceDir>`. Output streams to the terminal exactly like any other PTY.
- The user can interact with auth prompts as normal.

### On success (exit code 0)

- The clone PTY exits.
- The same tab's PTY is respawned using the existing Claude launcher, with `cwd = <workspaceDir>/<name>`.
- The cloned dir is registered via `workspace:track` so it appears in the Recent section next time.
- The tab title updates to the repo name (same logic as any opened workspace).

### On failure (non-zero exit)

- The clone PTY exits.
- The terminal scrollback (containing git's error output) is preserved.
- An inline banner renders above the terminal:

  ```
  Clone failed — [Retry] [Close tab]
  ```

- **Retry** respawns the same `git clone` command in the same tab.
- **Close tab** disposes the tab using the existing close-tab flow.

### Collisions

We do not pre-check for an existing target directory. `git clone` refuses to clone into an existing non-empty directory and exits non-zero; the user sees that error via the failure banner.

## Architecture

### Changed files

**`src/main/pty-manager.js`** — extend `spawn` to accept an optional `command` in the options object.

Current behavior hardcodes `source ~/.zshrc 2>/dev/null; exec claude[--dangerously-skip-permissions]`. The new signature:

```js
spawn(tabId, directory, onData, onExit, { dangerousMode, command })
```

- If `command` is omitted: existing behavior (Claude launcher).
- If `command === { type: "git-clone", url, name }`: spawn `git` directly via `ptyLib.spawn("git", ["clone", url, name], { cwd: directory, ... })`. No shell, no interpolation. `name` is validated to be a simple path segment (no `/`, no `..`, non-empty, ≤ 255 chars). `url` is validated against the accepted shapes above.
- `onPreSpawn` (AWS auth hook) is skipped for the git-clone case — it is specific to the Claude launcher and not needed for a plain `git clone`.

No existing caller is affected; the new option is additive.

**`src/main/main.js`** — new IPC handlers:

- `git:clone` — `{ tabId, url }` → loads settings, resolves `workspaceDir`, parses the URL to derive `name`, invokes `ptyManager.spawn(tabId, workspaceDir, onData, onExit, { dangerousMode, command: { type: "git-clone", url, name } })`. Returns `{ ok: true, name, path }` or `{ ok: false, error }`. Uses the same `pty:data` / `pty:exit` channels as the existing PTY flow so the renderer code needs no new event listeners.
- `git:parse-url` — `{ url }` → returns `{ valid: boolean, name?: string, normalizedUrl?: string }`. Used by the picker to decide whether to inject the synthetic clone match.

Validation is centralized in a small helper (`src/main/git-url.js`) so both handlers share it and it is unit-testable.

**`src/preload/preload.js`** — expose:

```js
cloneRepo: ({ tabId, url }) => ipcRenderer.invoke("git:clone", { tabId, url }),
parseGitUrl: (url) => ipcRenderer.invoke("git:parse-url", { url }),
```

**`src/renderer/picker.js`**

- Add a debounced async check on search input: if `parseGitUrl(value)` says valid, inject a synthetic item `{ isClone: true, url, name }` at the top of the filtered list.
- Add a second footer action "Clone repo…" next to "Browse…". When selected, call an internal `enterUrlMode()` that swaps the search label/placeholder and clears the list. `Escape` in URL mode returns to the normal picker.
- `selectItem` grows a new branch: if `dir.isClone`, close the picker and call a new `onClone(url)` callback (wired up the same way `onSelect` is).

**`src/renderer/app.js`**

- New handler `handleClone(url, isDangerous)`:
  1. Creates a new tab (reusing the existing tab-creation flow, but without calling `spawnPty`).
  2. Calls `electronAPI.cloneRepo({ tabId, url })`.
  3. Tab enters a "cloning" state: title reads `Cloning <name>…`; tab data-attribute `data-clone-state="in-progress"`.
- Listens for `pty:exit` on that tab id. If `exitCode === 0`:
  - Resolves the cloned path (`<workspaceDir>/<name>`).
  - Calls `electronAPI.spawnPty(tabId, clonedPath, { dangerousMode })` to replace the PTY with the Claude launcher.
  - Calls `electronAPI.trackWorkspace(clonedPath)`.
  - Sets tab title to `<name>`.
- If `exitCode !== 0`: renders the retry banner DOM element inside the tab's pane, with `Retry` and `Close tab` wired to re-invoke `cloneRepo` or close the tab respectively.

**`src/renderer/styles.css`** — styles for:
- URL-entry mode of the picker (label, placeholder, error state).
- Second footer action alongside "Browse…".
- Retry banner overlay at the top of the terminal pane.

### Data flow

```
User pastes URL or picks "Clone repo…"
  └─ picker.onClone(url)
       └─ app.js handleClone(url, isDangerous)
            ├─ tab created (no PTY yet)
            └─ electronAPI.cloneRepo({ tabId, url })
                 └─ main.js git:clone handler
                      ├─ validate URL → derive name
                      └─ ptyManager.spawn(..., { command: { type: "git-clone", url, name } })
                           ├─ pty:data stream → terminal renders live
                           └─ pty:exit event
                                ├─ exitCode 0: app.js respawns PTY in cloned dir (Claude launcher) + trackWorkspace
                                └─ exitCode ≠ 0: app.js shows retry banner
```

## Security & validation

- `git clone` is invoked via `node-pty` with args `["clone", url, name]`. No shell, so URL and name cannot inject shell commands.
- URL must match one of the accepted shapes; `file://`, `javascript:`, and other schemes are rejected.
- `name` is derived server-side (never from the renderer), validated to be a simple path segment, rejected if it contains `/`, `\`, `..`, NUL, or exceeds 255 chars.
- `workspaceDir` comes from the existing settings store; no renderer-supplied path reaches the spawn call.

## Testing strategy

New test files under `test/`:

- **`git-url.test.mjs`** — unit tests for the URL parser helper: all accepted shapes, rejection cases (`file://`, trailing slashes, empty, spaces, suspicious schemes), repo-name extraction (with/without `.git`), shorthand expansion.
- **`pty-manager-custom-command.test.mjs`** — verifies `spawn` with a git-clone command invokes `ptyLib.spawn("git", ["clone", url, name], …)` with the correct cwd, does not run the Claude launcher, and does not invoke the AWS pre-spawn hook.
- **`git-clone-ipc.test.mjs`** — handler validates URL, delegates to pty-manager, returns correct shape; rejects bad URLs without spawning anything.
- **`picker-clone-url-detect.test.mjs`** — typing a valid URL into the picker search injects a synthetic "Clone X" item at the top; typing a non-URL does not.
- **`picker-clone-footer.test.mjs`** — footer action is rendered, Enter from normal mode enters URL mode, Escape returns to the normal picker, Enter with a valid URL calls `onClone`.
- **`clone-retry-banner.test.mjs`** — non-zero PTY exit renders the banner; Retry reinvokes `cloneRepo`; Close tab removes the tab.

Existing PTY tests continue to pass (no existing caller changes).

No end-to-end network test — CI does not hit real git hosts. The clone invocation is mocked via the same fake-`ptyLib` pattern used in `pty-manager.test.mjs`.

## Rollout

- No feature flag. The change is purely additive — existing picker paths and PTY callers are unchanged.
- Update `CHANGELOG.md` under `[Unreleased]` with a "clone repo from picker" entry.
- No migration or settings change required.

## Open follow-ups (out of scope)

- Branch-at-clone (`--branch <name>`).
- Shallow clone toggle (`--depth 1`).
- SSH key management UI.
- Live progress parsing (currently the user just sees git's own progress output in the terminal).
- Target-folder rename UI before cloning.
