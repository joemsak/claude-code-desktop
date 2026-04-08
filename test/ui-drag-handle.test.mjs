import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('drag handle affordance', () => {
  it('has a drag-handle class with grab cursor', () => {
    expect(cssSource).toContain('.drag-handle');
    expect(cssSource).toContain('cursor: grab');
  });

  it('drag handle is hidden by default and visible on hover', () => {
    const handleBlock = cssSource.match(/\.drag-handle\s*\{[^}]*\}/);
    expect(handleBlock).not.toBeNull();
    expect(handleBlock[0]).toContain('opacity: 0');
    expect(cssSource).toContain('.tab-entry:hover .drag-handle');
  });
});
