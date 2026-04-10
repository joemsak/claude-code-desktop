import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const pickerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'picker.js'), 'utf-8');

describe('empty state improvements', () => {
  it('has a recent workspaces list in the empty state', () => {
    expect(htmlSource).toContain('id="empty-state-recents"');
  });

  it('has keyboard shortcut hints in the empty state', () => {
    expect(htmlSource).toContain('Cmd+T');
    expect(htmlSource).toContain('Cmd+,');
  });

  it('populates recent workspaces on empty state', () => {
    expect(appSource).toContain('empty-state-recents');
  });
});

describe('picker improvements', () => {
  it('has section headers for recent and all workspaces', () => {
    expect(pickerSource).toContain('picker-section-header');
  });

  it('shows directory paths alongside names in picker', () => {
    expect(pickerSource).toContain('picker-path');
  });
});
