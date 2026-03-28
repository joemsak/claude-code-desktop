import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('close last tab behavior', () => {
  it('does not call window.close() when closing the last tab', () => {
    const closeTabBlock = appSource.match(/async function closeTab\([\s\S]*?\n\}/);
    expect(closeTabBlock).not.toBeNull();
    const closeCode = closeTabBlock[0];

    // Should NOT force quit when closing the last tab
    expect(closeCode).not.toContain('window.close()');
  });

  it('does not show a confirm dialog when closing the last tab', () => {
    const closeTabBlock = appSource.match(/async function closeTab\([\s\S]*?\n\}/);
    expect(closeTabBlock).not.toBeNull();
    const closeCode = closeTabBlock[0];

    // Should NOT prompt the user with a confirm dialog
    expect(closeCode).not.toContain('confirm(');
  });

  it('shows the empty state after closing the last tab', () => {
    const closeTabBlock = appSource.match(/async function closeTab\([\s\S]*?\n\}/);
    expect(closeTabBlock).not.toBeNull();
    const closeCode = closeTabBlock[0];

    // Should call updateEmptyState to show the empty state
    expect(closeCode).toContain('updateEmptyState');
  });
});
