import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'settings.js'), 'utf-8');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf-8');

describe('skip dangerous confirm setting', () => {
  it('HTML has a skip-confirm toggle checkbox', () => {
    expect(htmlSource).toContain('id="settings-skip-confirm-toggle"');
  });

  it('HTML has a skip-confirm row that can be disabled', () => {
    expect(htmlSource).toContain('id="settings-skip-confirm-row"');
  });

  it('app.js loads skipDangerousConfirm on startup', () => {
    expect(appSource).toContain('skipDangerousConfirm');
    expect(appSource).toContain('startupSettings.skipDangerousConfirm');
  });

  it('app.js bypasses the confirm dialog when skipDangerousConfirm and defaultDangerousMode are both true', () => {
    expect(appSource).toMatch(/skipDangerousConfirm.*&&.*defaultDangerousMode|defaultDangerousMode.*&&.*skipDangerousConfirm/);
  });

  it('settings.js handles the skip-confirm toggle', () => {
    expect(settingsSource).toContain('skipConfirmToggle');
  });

  it('settings.js loads skipDangerousConfirm value', () => {
    expect(settingsSource).toContain('skipDangerousConfirm');
  });

  it('settings.js disables skip-confirm row when dangerous mode is off', () => {
    expect(settingsSource).toContain('skipConfirmRow');
  });

  it('main.js loads skipDangerousConfirm from settings', () => {
    expect(mainSource).toContain('data.skipDangerousConfirm');
  });

  it('main.js saves skipDangerousConfirm to settings', () => {
    expect(mainSource).toContain('settings.skipDangerousConfirm');
  });
});
