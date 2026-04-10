import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pickerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'picker.js'), 'utf-8');

describe('picker hover selection skips non-selectable items', () => {
  it('updateSelection skips section headers in addition to separators', () => {
    // The bug: updateSelection only skips picker-separator items,
    // but not picker-section-header items. Section headers are counted
    // in the idx, causing selected class to be applied to the wrong item
    // (off by the number of section headers above). Combined with CSS :hover,
    // this results in two items being highlighted at once.
    const fnMatch = pickerSource.match(
      /function updateSelection\(\)\s*\{[\s\S]*?\n {2}\}/
    );
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch[0];

    // Must skip picker-section-header (non-selectable header rows)
    expect(fn).toContain('picker-section-header');
  });
});
