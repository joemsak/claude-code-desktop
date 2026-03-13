import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('top bar', () => {
  it('has a topbar element in the HTML', () => {
    expect(htmlSource).toContain('id="topbar"');
  });

  it('topbar is draggable for window movement', () => {
    expect(cssSource).toContain('-webkit-app-region: drag');
    // Topbar specific selector
    expect(cssSource).toMatch(/#topbar[\s\S]*?-webkit-app-region:\s*drag/);
  });

  it('shows the active tab directory path', () => {
    expect(htmlSource).toContain('id="topbar-path"');
    expect(appSource).toContain('topbarPathEl');
  });

  it('updates topbar path when switching tabs', () => {
    // switchTab should call updateTopbar
    const switchBlock = appSource.match(/function switchTab[\s\S]*?\n\}/);
    expect(switchBlock).not.toBeNull();
    expect(switchBlock[0]).toContain('updateTopbar');
  });

  it('updateTopbar sets path from active tab directory', () => {
    const updateBlock = appSource.match(/function updateTopbar[\s\S]*?\n\}/);
    expect(updateBlock).not.toBeNull();
    expect(updateBlock[0]).toContain('topbarPathEl');
    expect(updateBlock[0]).toContain('directory');
  });
});
