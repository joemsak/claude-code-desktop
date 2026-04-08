import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf-8');
const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload', 'preload.js'), 'utf-8');

describe('dangerous mode settings toggle', () => {
  it('has a toggle switch in settings HTML', () => {
    expect(htmlSource).toContain('id="settings-dangerous-toggle"');
  });

  it('app.js loads defaultDangerousMode on startup', () => {
    expect(appSource).toContain('defaultDangerousMode');
    expect(appSource).toContain('startupSettings.defaultDangerousMode');
  });

  it('toggle change saves the setting', () => {
    expect(appSource).toContain('defaultDangerousMode');
  });
});

describe('dangerous mode shortcuts', () => {
  it('main.js has Cmd+Shift+T menu item', () => {
    expect(mainSource).toContain('CmdOrCtrl+Shift+T');
  });

  it('preload exposes onNewTabDangerous event', () => {
    expect(preloadSource).toContain('menu:new-tab-dangerous');
  });

  it('app.js listens for the dangerous tab menu event', () => {
    expect(appSource).toContain('onNewTabDangerous');
  });
});
