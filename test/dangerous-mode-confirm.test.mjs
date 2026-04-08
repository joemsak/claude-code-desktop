import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('dangerous mode confirmation modal', () => {
  it('has a confirm overlay element in the HTML', () => {
    expect(htmlSource).toContain('id="confirm-dangerous-overlay"');
  });

  it('has launch-dangerous and launch-normal buttons', () => {
    expect(htmlSource).toContain('id="confirm-dangerous-btn"');
    expect(htmlSource).toContain('id="confirm-normal-btn"');
  });

  it('has a link to open settings from the modal', () => {
    expect(htmlSource).toContain('id="confirm-settings-link"');
  });

  it('has CSS styles for the confirmation overlay', () => {
    expect(cssSource).toContain('#confirm-dangerous-overlay');
  });

  it('app.js has a showDangerousConfirm function', () => {
    expect(appSource).toContain('function showDangerousConfirm');
  });

  it('picker selection checks pendingDangerousMode before creating tab', () => {
    expect(appSource).toContain('pendingDangerousMode');
  });

  it('escape key on confirmation modal triggers normal launch', () => {
    expect(appSource).toMatch(/confirm.*Escape|Escape.*confirm/s);
  });
});
