# Skip Dangerous Launch Confirmation — Design Spec

**Date:** 2026-05-20

## Problem

When `defaultDangerousMode` is enabled, opening any workspace still shows a "Skip Permission Prompts?" confirmation dialog every time. Users who have already opted into dangerous mode as their default find this redundant.

## Goal

Add a setting that lets users bypass the confirmation dialog when dangerous mode is their configured default.

## Behavior

- When `skipDangerousConfirm` is `true` **and** `defaultDangerousMode` is `true`: skip the dialog and launch directly in dangerous mode.
- When `skipDangerousConfirm` is `true` but `defaultDangerousMode` is `false`: still show the confirmation (one-off dangerous launches keep the safety check).
- When `skipDangerousConfirm` is `false`: existing behavior unchanged.

## Changes

### `src/renderer/index.html`

Add a toggle row beneath the existing `settings-dangerous-toggle` row:

```html
<div class="settings-toggle-row" id="settings-skip-confirm-row">
  <div class="settings-toggle-label">
    <label class="settings-label">Skip Launch Confirmation</label>
    <p class="settings-hint">Skip the confirmation dialog when dangerous mode is your default</p>
  </div>
  <label class="toggle-switch">
    <input type="checkbox" id="settings-skip-confirm-toggle">
    <span class="toggle-slider"></span>
  </label>
</div>
```

The row is visually disabled (opacity + pointer-events: none) when `defaultDangerousMode` is off. When `defaultDangerousMode` is toggled off, `skipDangerousConfirm` is also set to `false` in both UI and persisted settings.

### `src/renderer/settings.js`

- Accept `skipConfirmToggle` and `skipConfirmRow` in `dom`, and `onSkipConfirmChange` callback.
- On `open()`: set `skipConfirmToggle.checked = settings.skipDangerousConfirm || false`; apply disabled state based on `settings.defaultDangerousMode`.
- On `dangerousToggle` change: enable/disable `skipConfirmRow` accordingly; if dangerous mode is turned off, uncheck `skipConfirmToggle` and call `onSkipConfirmChange(false)`.
- On `skipConfirmToggle` change: call `onSkipConfirmChange(skipConfirmToggle.checked)`.

### `src/renderer/app.js`

- At startup: read `startupSettings.skipDangerousConfirm` into `let skipDangerousConfirm`.
- In `showDangerousConfirm(directory)`: if `skipDangerousConfirm && defaultDangerousMode`, call `createTab(directory, null, null, { dangerousMode: true })` and return early.
- Wire `onSkipConfirmChange` callback to update `skipDangerousConfirm` and call `electronAPI.saveSettings({ skipDangerousConfirm: enabled })`.

### `src/main/main.js`

- In `loadSettings` / `saveSettings`: handle `skipDangerousConfirm` boolean alongside `defaultDangerousMode`.

## Tests

- **Bypass path**: `skipDangerousConfirm = true` + `defaultDangerousMode = true` → `createTab` called directly, no dialog.
- **No bypass when not default**: `skipDangerousConfirm = true` + `defaultDangerousMode = false` → dialog shown.
- **No bypass when setting off**: `skipDangerousConfirm = false` + `defaultDangerousMode = true` → dialog shown.
- **Default state**: `skipDangerousConfirm` defaults to `false`.
- **UI disabled state**: `skipConfirmRow` is disabled/grayed when `defaultDangerousMode` is off; enabled when on.
- **Auto-clear**: turning off `defaultDangerousMode` resets `skipDangerousConfirm` to `false` in both UI and persisted settings.
