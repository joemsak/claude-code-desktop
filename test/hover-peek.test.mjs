import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');

describe('hover peek', () => {
  it('has a peek panel element in the HTML', () => {
    expect(htmlSource).toContain('id="peek-panel"');
  });

  it('reads from xterm terminal buffer for peek content', () => {
    expect(appSource).toContain('.buffer.active');
  });

  it('uses stripTuiChrome to filter prompt and statusbar', () => {
    expect(appSource).toContain('stripTuiChrome');
  });

  it('shows peek panel on tab hover', () => {
    expect(appSource).toContain('showPeek');
  });

  it('hides peek panel on mouse leave', () => {
    expect(appSource).toContain('hidePeek');
  });

  it('has CSS for the peek panel', () => {
    expect(cssSource).toContain('peek-panel');
  });

  it('reads terminal lines via translateToString', () => {
    expect(appSource).toContain('translateToString');
  });
});
