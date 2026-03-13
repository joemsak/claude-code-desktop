import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('picker click regression guard', () => {
  it('mouseenter updates selection via CSS toggle, not DOM re-render', () => {
    // The bug: mouseenter called renderPickerList() which destroyed DOM nodes
    // mid-click. The fix: mouseenter calls updatePickerSelection() instead.
    const mouseenterBlock = appSource.match(/addEventListener\("mouseenter"[\s\S]*?\}\)/g);
    expect(mouseenterBlock).not.toBeNull();

    const handler = mouseenterBlock.find((block) => block.includes('pickerSelectedIndex'));
    expect(handler).toBeDefined();
    expect(handler).toContain('updatePickerSelection');
    expect(handler).not.toContain('renderPickerList');
  });

  it('updatePickerSelection exists and only toggles classes', () => {
    expect(appSource).toContain('function updatePickerSelection()');
    // Should use classList.toggle, not innerHTML
    const fnMatch = appSource.match(/function updatePickerSelection\(\)\s*\{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch[0]).toContain('classList.toggle');
    expect(fnMatch[0]).not.toContain('innerHTML');
  });
});
