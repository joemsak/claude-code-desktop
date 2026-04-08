import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('drag handle affordance', () => {
  it('tab-entry has a before pseudo-element for drag handle', () => {
    expect(cssSource).toContain('.tab-entry:hover::before');
  });

  it('drag cursor shows grab on hover', () => {
    expect(cssSource).toContain('cursor: grab');
  });

  it('drag handle uses 14px font size for visibility', () => {
    const beforeBlock = cssSource.match(/\.tab-entry:hover::before\s*\{[^}]*\}/);
    expect(beforeBlock).not.toBeNull();
    expect(beforeBlock[0]).toContain('font-size: 14px');
  });

  it('drag handle uses overlay1 color for visibility', () => {
    const beforeBlock = cssSource.match(/\.tab-entry:hover::before\s*\{[^}]*\}/);
    expect(beforeBlock).not.toBeNull();
    expect(beforeBlock[0]).toContain('var(--overlay1)');
  });
});
