import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('follow indicator transition', () => {
  it('follow indicator has background transition', () => {
    const block = cssSource.match(/#follow-indicator\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toContain('background');
  });
});
