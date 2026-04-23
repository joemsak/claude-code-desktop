import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pickerSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'picker.js'),
  'utf-8',
);

describe('picker clone URL detection (search-driven synthetic match)', () => {
  it('calls electronAPI.parseGitUrl with the current search value', () => {
    expect(pickerSource).toContain('electronAPI.parseGitUrl');
  });

  it('stores a clone candidate in picker state', () => {
    // Expect some state named cloneCandidate (or similar) that holds the parsed URL
    expect(pickerSource).toMatch(/cloneCandidate/);
  });

  it('renders a picker-clone item when a clone candidate exists', () => {
    expect(pickerSource).toMatch(/picker-clone/);
  });

  it('routes clone-item activation through a dedicated onClone callback', () => {
    // The picker factory must accept an onClone option and route
    // isClone items to it (not onSelect / onSelectDangerous).
    expect(pickerSource).toContain('onClone');
    expect(pickerSource).toMatch(/isClone/);
  });

  it('includes onClone in the factory destructuring signature', () => {
    const header = pickerSource.match(
      /export function createPicker\(\{[\s\S]*?\}\)/,
    );
    expect(header).not.toBeNull();
    expect(header[0]).toContain('onClone');
  });

  it('injects the clone candidate into the filtered list ahead of other entries', () => {
    // A clone candidate should appear at the top of the rendered list
    // so Enter on the search-URL flow selects it by default.
    const getFilteredDirsMatch = pickerSource.match(
      /function getFilteredDirs\([\s\S]*?\n {2}\}/,
    );
    expect(getFilteredDirsMatch).not.toBeNull();
    expect(getFilteredDirsMatch[0]).toMatch(/cloneCandidate|isClone/);
  });
});
