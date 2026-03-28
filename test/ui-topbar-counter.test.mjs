import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('topbar tab counter', () => {
  it('has a topbar-counter element in HTML', () => {
    expect(htmlSource).toContain('topbar-counter');
  });

  it('updateTopbar sets tab position counter', () => {
    const fnMatch = appSource.match(/function updateTopbar\(\)\s*\{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch[0];
    expect(fn).toContain('topbar-counter');
    expect(fn).toContain('tabs.length');
  });

  it('has CSS for topbar counter', () => {
    expect(cssSource).toContain('#topbar-counter');
  });
});
