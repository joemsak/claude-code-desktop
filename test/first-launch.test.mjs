import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('first launch behavior', () => {
  it('opens the directory picker when there are no saved tabs', () => {
    // The init function should check for empty tabs and open the picker
    // instead of creating a default tab in the home directory
    const initBlock = appSource.match(/async function init\(\)\s*\{[\s\S]*?\n\}/);
    expect(initBlock).not.toBeNull();
    const initCode = initBlock[0];

    // Should check for empty/no tabs and open picker
    expect(initCode).toContain('openPicker');
    // Should NOT have a hardcoded fallback to create a tab in homePath
    expect(initCode).not.toMatch(/tabs:\s*\[\s*\{\s*directory:\s*homePath/);
  });
});
