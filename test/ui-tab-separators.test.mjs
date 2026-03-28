import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('tab separator breathing room', () => {
  it('tab entries have bottom border for visual separation', () => {
    const tabEntryBlock = cssSource.match(/\.tab-entry\s*\{[^}]*\}/);
    expect(tabEntryBlock).not.toBeNull();
    expect(tabEntryBlock[0]).toContain('border-bottom');
  });
});
