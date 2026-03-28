import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf-8');

describe('settings UI', () => {
  it('has a Settings menu item with Cmd+, accelerator', () => {
    expect(mainSource).toContain('Settings');
    expect(mainSource).toContain('CmdOrCtrl+,');
  });

  it('sends a menu event to open settings', () => {
    expect(mainSource).toContain('menu:open-settings');
  });

  it('has an IPC handler for saving settings', () => {
    expect(mainSource).toContain('settings:save');
  });

  it('has an IPC handler for loading settings', () => {
    expect(mainSource).toContain('settings:load');
  });
});
