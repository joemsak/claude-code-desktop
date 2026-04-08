import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('active tab left accent', () => {
  it('has an inset box-shadow accent on active tab entry', () => {
    const activeBlock = cssSource.match(/\.tab-entry\.active\s*\{[^}]*\}/);
    expect(activeBlock).not.toBeNull();
    expect(activeBlock[0]).toContain('box-shadow');
    expect(activeBlock[0]).toContain('var(--accent)');
  });
});
