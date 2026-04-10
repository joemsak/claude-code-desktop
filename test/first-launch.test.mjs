import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const pickerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'picker.js'), 'utf-8');

describe('first launch behavior', () => {
  it('shows the welcome screen (not the picker) when there are no saved tabs', () => {
    const initBlock = appSource.match(/async function init\(\)\s*\{[\s\S]*?\n\}/);
    expect(initBlock).not.toBeNull();
    const initCode = initBlock[0];

    // Should NOT auto-open picker — welcome screen is the landing page
    expect(initCode).not.toContain('picker.open');
    expect(initCode).not.toMatch(/tabs:\s*\[\s*\{\s*directory:\s*homePath/);
  });

  it('close function never auto-creates tabs', () => {
    const closeBlock = pickerSource.match(/function close\(\)\s*\{[\s\S]*?\n {2}\}/);
    expect(closeBlock).not.toBeNull();
    const closeCode = closeBlock[0];

    // Should NOT create tabs — just close the overlay and call onClose
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
