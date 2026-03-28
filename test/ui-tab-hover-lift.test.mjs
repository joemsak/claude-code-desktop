import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('tab hover lift', () => {
  it('tab-entry has transform transition', () => {
    const tabEntryBlock = cssSource.match(/\.tab-entry\s*\{[^}]*\}/);
    expect(tabEntryBlock).not.toBeNull();
    expect(tabEntryBlock[0]).toContain('transform');
  });

  it('tab-entry hover has translateX', () => {
    const hoverBlock = cssSource.match(/\.tab-entry:hover\s*\{[^}]*\}/);
    expect(hoverBlock).not.toBeNull();
    expect(hoverBlock[0]).toContain('translateX');
  });
});
