import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('topbar status badge and tab name', () => {
  it('has a topbar-status element in HTML', () => {
    expect(htmlSource).toContain('topbar-status');
  });

  it('has a topbar-name element in HTML', () => {
    expect(htmlSource).toContain('topbar-name');
  });

  it('updateTopbar sets the tab name', () => {
    const fnMatch = appSource.match(/function updateTopbar\(\)\s*\{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch[0];
    expect(fn).toContain('topbarNameEl');
    expect(fn).toContain('getDisplayName');
  });

  it('updateTopbar shows status dot for working/waiting states', () => {
    const fnMatch = appSource.match(/function updateTopbar\(\)\s*\{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch[0];
    expect(fn).toContain('status-dot');
  });

  it('has CSS for topbar status elements', () => {
    expect(cssSource).toContain('#topbar-status');
  });
});
