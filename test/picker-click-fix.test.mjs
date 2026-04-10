import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pickerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'picker.js'), 'utf-8');

describe('picker click regression guard', () => {
  it('mouseenter updates selection via CSS toggle, not DOM re-render', () => {
    // The bug: mouseenter called renderList() which destroyed DOM nodes
    // mid-click. The fix: mouseenter calls updateSelection() instead.
    const mouseenterBlock = pickerSource.match(/addEventListener\("mouseenter"[\s\S]*?\}\)/g);
    expect(mouseenterBlock).not.toBeNull();

    const handler = mouseenterBlock.find((block) => block.includes('pickerSelectedIndex'));
    expect(handler).toBeDefined();
    expect(handler).toContain('updateSelection');
    expect(handler).not.toContain('renderList');
  });

  it('updateSelection exists and only toggles classes', () => {
    expect(pickerSource).toContain('function updateSelection()');
    // Should use classList.toggle, not innerHTML
    const fnMatch = pickerSource.match(/function updateSelection\(\)\s*\{[\s\S]*?\n {2}\}/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch[0]).toContain('classList.toggle');
    expect(fnMatch[0]).not.toContain('innerHTML');
  });
});
