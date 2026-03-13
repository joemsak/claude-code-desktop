import { describe, it, expect } from 'vitest';
import { terminalTheme } from '../src/renderer/theme.js';

describe('theme', () => {
  it('exports terminalTheme with correct background', () => {
    expect(terminalTheme.background).toBe('#1e1e2e');
  });

  it('exports terminalTheme with correct foreground', () => {
    expect(terminalTheme.foreground).toBe('#cdd6f4');
  });

  it('exports terminalTheme with cursor color', () => {
    expect(terminalTheme.cursor).toBe('#f5e0dc');
  });

  it('exports terminalTheme with selection color', () => {
    expect(terminalTheme.selectionBackground).toBe('#45475a');
  });

  it('has all 8 ANSI colors as valid hex', () => {
    const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
    for (const color of colors) {
      expect(terminalTheme[color]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has all 8 bright ANSI colors as valid hex', () => {
    const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
    for (const color of colors) {
      const bright = 'bright' + color.charAt(0).toUpperCase() + color.slice(1);
      expect(terminalTheme[bright]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
