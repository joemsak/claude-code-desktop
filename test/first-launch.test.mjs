import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('first launch behavior', () => {
  it('opens the directory picker when there are no saved tabs', () => {
    const initBlock = appSource.match(/async function init\(\)\s*\{[\s\S]*?\n\}/);
    expect(initBlock).not.toBeNull();
    const initCode = initBlock[0];

    expect(initCode).toContain('openPicker');
    expect(initCode).not.toMatch(/tabs:\s*\[\s*\{\s*directory:\s*homePath/);
  });

  it('closePicker never auto-creates tabs', () => {
    const closeBlock = appSource.match(/function closePicker\(\)\s*\{[\s\S]*?\n\}/);
    expect(closeBlock).not.toBeNull();
    const closeCode = closeBlock[0];

    // Should NOT create tabs — just close the overlay and show empty state
    expect(closeCode).not.toContain('createTab');
  });

  it('shows an empty state when no tabs are open', () => {
    // An empty-state element should exist in the HTML
    const htmlSource = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8'
    );
    expect(htmlSource).toContain('id="empty-state"');
  });

  it('empty state is shown/hidden based on tab count', () => {
    // renderSidebar or a helper should toggle empty state visibility
    expect(appSource).toContain('empty-state');
    expect(appSource).toContain('emptyStateEl');
  });
});
