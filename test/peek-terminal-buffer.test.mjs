import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('peek reads from terminal buffer instead of raw outputBuffer', () => {
  it('showPeek reads from the xterm terminal buffer, not outputBuffer', () => {
    // The bug: outputBuffer stores raw PTY data with ANSI stripped, but
    // doesn't handle cursor movements, line overwrites, or DEC private modes
    // (e.g. ?2026l for synchronized output). This causes garbage text and
    // "thinking" spinner artifacts in the peek panel.
    //
    // The fix: read from tab.terminal.buffer which has already processed
    // all escape sequences correctly via xterm.js.
    const showPeekMatch = appSource.match(
      /function showPeek\([\s\S]*?\n\}/
    );
    expect(showPeekMatch).not.toBeNull();
    const fn = showPeekMatch[0];

    // Should read from terminal buffer, not outputBuffer
    expect(fn).toContain('.buffer.');
    expect(fn).not.toContain('outputBuffer');
  });
});
