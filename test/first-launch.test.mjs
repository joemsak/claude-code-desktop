import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('first launch behavior', () => {
  it('opens the directory picker when there are no saved tabs', () => {
    const initBlock = appSource.match(/async function init\(\)\s*\{[\s\S]*?\n\}/);
    expect(initBlock).not.toBeNull();
    const initCode = initBlock[0];

    expect(initCode).toContain('openPicker');
    expect(initCode).not.toMatch(/tabs:\s*\[\s*\{\s*directory:\s*homePath/);
  });

  it('closePicker creates a home tab when no tabs exist (escape fallback)', () => {
    // When user escapes the picker on first launch, closePicker should
    // create a home dir tab if there are none
    const closeBlock = appSource.match(/function closePicker\(\)\s*\{[\s\S]*?\n\}/);
    expect(closeBlock).not.toBeNull();
    const closeCode = closeBlock[0];

    expect(closeCode).toContain('tabs.length === 0');
    expect(closeCode).toContain('createTab');
  });

  it('selectPickerItem replaces the lone home tab instead of adding', () => {
    // When picker was opened because only tab is ~, selecting a workspace
    // should replace that tab, not add a second one
    const selectBlock = appSource.match(/async function selectPickerItem[\s\S]*?\n\}/);
    expect(selectBlock).not.toBeNull();
    const selectCode = selectBlock[0];

    // Should check for lone home tab and remove it before creating new one
    expect(selectCode).toContain('tabs.length === 1');
    expect(selectCode).toContain('homePath');
    expect(selectCode).toContain('killPty');
  });
});
