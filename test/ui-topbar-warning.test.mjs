import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('topbar exited/warning state', () => {
  it('updateTopbar handles exited tab state', () => {
    const fnMatch = appSource.match(/function updateTopbar\(\)\s*\{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch[0];
    expect(fn).toContain('tab.exited');
    expect(fn).toContain('topbar-exited');
  });

  it('updateTopbar handles missing directory warning', () => {
    const fnMatch = appSource.match(/function updateTopbar\(\)\s*\{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch[0];
    expect(fn).toContain('_originalDir');
    expect(fn).toContain('topbar-warning');
  });

  it('has CSS for topbar warning and exited states', () => {
    expect(cssSource).toContain('.topbar-exited');
    expect(cssSource).toContain('.topbar-warning');
  });
});
