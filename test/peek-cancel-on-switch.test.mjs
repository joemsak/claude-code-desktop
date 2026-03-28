import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('peek is cancelled when switching tabs', () => {
  it('switchTab calls hidePeek to cancel any pending or visible peek', () => {
    // The bug: hovering a tab starts a 500ms timeout to show peek.
    // If the user clicks the tab before the timeout fires, the tab
    // becomes active but the peek still appears because the timeout
    // wasn't cancelled.
    const fnMatch = appSource.match(
      /function switchTab\([\s\S]*?\n\}/
    );
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch[0];

    expect(fn).toContain('hidePeek');
  });
});
