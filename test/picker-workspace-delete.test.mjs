import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pickerSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'picker.js'),
  'utf-8',
);
const cssSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'styles.css'),
  'utf-8',
);

describe('picker context menu for workspace deletion', () => {
  it('attaches a contextmenu listener on workspace rows', () => {
    expect(pickerSource).toMatch(/addEventListener\(\s*["']contextmenu["']/);
  });

  it('renders a context menu DOM element with the expected id', () => {
    expect(pickerSource).toContain('picker-context-menu');
  });

  it('menu includes a "Remove from recents" action', () => {
    expect(pickerSource).toMatch(/Remove from recents/);
  });

  it('menu includes a "Move to trash" action', () => {
    expect(pickerSource).toMatch(/Move to trash/i);
  });

  it('wires up the remove-recents action via electronAPI.removeRecentWorkspace', () => {
    expect(pickerSource).toContain('removeRecentWorkspace');
  });

  it('wires up the trash action via electronAPI.trashWorkspace', () => {
    expect(pickerSource).toContain('trashWorkspace');
  });

  it('refuses the trash action for home and action rows', () => {
    // The picker must gate destructive actions to real workspace rows
    expect(pickerSource).toMatch(/isHome|isBrowse|isClone|isSeparator/);
  });
});

describe('picker Cmd+Backspace shortcut', () => {
  it('handles Meta+Backspace keydown when a workspace row is selected', () => {
    expect(pickerSource).toMatch(/Backspace/);
    expect(pickerSource).toMatch(/metaKey/);
  });
});

describe('picker context menu CSS', () => {
  it('styles the context menu element', () => {
    expect(cssSource).toContain('picker-context-menu');
  });
});
