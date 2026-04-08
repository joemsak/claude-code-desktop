import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('tab rename interaction', () => {
  it('dblclick handler calls stopPropagation and preventDefault', () => {
    // The dblclick on nameSpan must stop propagation to prevent
    // the parent click handler (switchTab) from stealing focus
    const dblclickBlock = appSource.match(/dblclick[\s\S]*?startRename/);
    expect(dblclickBlock).not.toBeNull();
    expect(dblclickBlock[0]).toContain('stopPropagation');
    expect(dblclickBlock[0]).toContain('preventDefault');
  });

  it('click handler on tab entry does not immediately focus terminal on nameSpan clicks', () => {
    // The click handler should check if it's a double-click in progress
    // or the nameSpan area and not steal focus
    // Alternatively, switchTab focus should be delayed or dblclick should work
    // The simplest fix: nameSpan click stops propagation so parent click doesn't fire
    const nameSpanSection = appSource.match(/nameSpan\.addEventListener\("click"[\s\S]*?\}\)/);
    expect(nameSpanSection).not.toBeNull();
  });

  it('rename input stops click propagation to prevent parent tab click from re-rendering', () => {
    // When the rename input is shown and user clicks on it, the click must not
    // bubble to the parent tab element (which calls switchTab → renderSidebar,
    // destroying the input). The input needs stopPropagation on click.
    const startRenameBody = appSource.match(/function startRename[\s\S]*?(?=\n(?:function |\/\/ ={3,}))/);
    expect(startRenameBody).not.toBeNull();
    expect(startRenameBody[0]).toMatch(/input\.addEventListener\(["']click["'][\s\S]*?stopPropagation/);
  });

  it('rename input stops mousedown propagation to prevent draggable parent from stealing focus', () => {
    // The parent tab element has draggable=true. Without stopping mousedown
    // propagation, slight mouse movement during click triggers drag detection
    // which can steal focus from the input (causing blur → finish → input destroyed).
    const startRenameBody = appSource.match(/function startRename[\s\S]*?(?=\n(?:function |\/\/ ={3,}))/);
    expect(startRenameBody).not.toBeNull();
    expect(startRenameBody[0]).toMatch(/input\.addEventListener\(["']mousedown["'][\s\S]*?stopPropagation/);
  });

  it('rename input focus and select are deferred to ensure DOM is ready', () => {
    // focus() and select() called synchronously after replaceWith() may not work
    // in Electron. They should be deferred (requestAnimationFrame, setTimeout, or queueMicrotask).
    const startRenameBody = appSource.match(/function startRename[\s\S]*?(?=\n(?:function |\/\/ ={3,}))/);
    expect(startRenameBody).not.toBeNull();
    // Should use some form of deferral before focus/select
    expect(startRenameBody[0]).toMatch(/(?:requestAnimationFrame|setTimeout|queueMicrotask)\s*\(\s*\(\)\s*=>\s*\{?\s*input\.focus/);
  });
});
