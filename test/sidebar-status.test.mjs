import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('sidebar status indicators', () => {
  it('listens for tab state changes from main process', () => {
    expect(appSource).toContain('onTabStateChange');
  });

  it('stores state per tab', () => {
    expect(appSource).toContain('tab.state');
  });

  it('renders status dot in sidebar for working tabs', () => {
    expect(appSource).toContain('status-dot');
  });

  it('has CSS for status dot states', () => {
    expect(cssSource).toContain('status-dot');
    expect(cssSource).toContain('.status-working');
    expect(cssSource).toContain('.status-waiting');
  });

  it('has a pulse animation for the working state', () => {
    expect(cssSource).toContain('@keyframes pulse');
  });

  it('dims exited tabs with strikethrough', () => {
    expect(cssSource).toContain('tab-exited');
  });
});
