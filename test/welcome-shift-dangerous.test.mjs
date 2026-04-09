import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');
const _appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('welcome page shift-dangerous hint', () => {
  it('has a shift-hint element in the empty state HTML', () => {
    expect(htmlSource).toContain('id="empty-state-shift-hint"');
  });

  it('has CSS for the shift hint', () => {
    expect(cssSource).toContain('.empty-state-shift-hint');
  });
});

describe('welcome page shift key state tracking', () => {
  it('app.js tracks shiftHeld state', () => {
    expect(_appSource).toContain('let shiftHeld = false');
  });

  it('app.js has a DOM ref for the shift hint element', () => {
    expect(_appSource).toContain('getElementById("empty-state-shift-hint")');
  });

  it('app.js adds keydown/keyup listeners for Shift', () => {
    expect(_appSource).toContain('updateShiftState');
  });

  it('applies empty-shift-dangerous class when shift activates dangerous', () => {
    expect(_appSource).toContain('empty-shift-dangerous');
  });

  it('applies empty-shift-standard class when shift activates standard', () => {
    expect(_appSource).toContain('empty-shift-standard');
  });

  it('applies empty-default-dangerous class when dangerous is the default', () => {
    expect(_appSource).toContain('empty-default-dangerous');
  });

  it('updates button text and hint text based on shift/default state', () => {
    expect(_appSource).toContain('Hold <kbd>Shift</kbd> to skip permissions');
    expect(_appSource).toContain('Hold <kbd>Shift</kbd> for standard mode');
  });
});

describe('welcome page click handlers respect shift state', () => {
  it('has an isEffectiveDangerous helper for mode XOR logic', () => {
    expect(_appSource).toContain('function isEffectiveDangerous()');
    expect(_appSource).toContain('shiftHeld !== defaultDangerousMode');
  });

  it('has a getModeLabels helper for button/hint text', () => {
    expect(_appSource).toContain('function getModeLabels(');
  });

  it('recent item click handler uses isEffectiveDangerous', () => {
    expect(_appSource).toContain('isEffectiveDangerous()');
  });

  it('Browse button click handler uses isEffectiveDangerous', () => {
    expect(_appSource).toMatch(/emptyStateOpenBtn[\s\S]*isEffectiveDangerous/);
  });
});
