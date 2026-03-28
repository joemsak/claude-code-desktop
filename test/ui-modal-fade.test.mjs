import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('modal overlay fade animation', () => {
  it('has a fadeIn keyframe animation', () => {
    expect(cssSource).toContain('@keyframes fadeIn');
  });

  it('picker overlay uses fade animation', () => {
    const pickerBlock = cssSource.match(/#picker-overlay\s*\{[^}]*\}/);
    expect(pickerBlock).not.toBeNull();
    expect(pickerBlock[0]).toContain('animation');
  });

  it('settings overlay uses fade animation', () => {
    const settingsBlock = cssSource.match(/#settings-overlay\s*\{[^}]*\}/);
    expect(settingsBlock).not.toBeNull();
    expect(settingsBlock[0]).toContain('animation');
  });
});
