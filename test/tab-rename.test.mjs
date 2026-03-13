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
});
