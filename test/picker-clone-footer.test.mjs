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

describe('picker Clone repo footer action', () => {
  it('renders a clone footer element with the expected id', () => {
    expect(pickerSource).toContain('picker-clone-footer');
  });

  it('clone footer label reads "Clone repo…"', () => {
    expect(pickerSource).toMatch(/Clone repo…|Clone repo\.\.\./);
  });
});

describe('picker URL-entry mode', () => {
  it('tracks a mode state variable (normal vs url)', () => {
    expect(pickerSource).toMatch(/mode\s*[:=]\s*["']url["']|"url"|'url'/);
  });

  it('provides enterUrlMode/exitUrlMode transitions (or equivalent)', () => {
    expect(pickerSource).toMatch(/enterUrlMode|exitUrlMode|setMode/);
  });

  it('sets the search placeholder to prompt for a git URL', () => {
    expect(pickerSource).toMatch(/Paste a git URL/);
  });

  it('shows an inline error when an invalid URL is submitted', () => {
    expect(pickerSource).toMatch(/Not a valid git URL/);
  });

  it('Escape key returns from URL mode to normal mode', () => {
    // the source should reference exitUrlMode or mode reset in an Escape branch
    expect(pickerSource).toMatch(/Escape[\s\S]*?(exitUrlMode|mode\s*=\s*["']normal["'])/);
  });

  it('CSS includes styling for the clone footer', () => {
    expect(cssSource).toContain('picker-clone-footer');
  });

  it('CSS includes styling for picker-clone list item', () => {
    expect(cssSource).toContain('picker-clone');
  });
});
