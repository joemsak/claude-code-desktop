import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('refined button hover states', () => {
  it('close button has an active state', () => {
    expect(cssSource).toContain('.close-btn:active');
  });

  it('new-tab button has transform on hover', () => {
    const hoverBlock = cssSource.match(/#new-tab-btn:hover\s*\{[^}]*\}/);
    expect(hoverBlock).not.toBeNull();
    expect(hoverBlock[0]).toContain('transform');
  });

  it('empty state open button has an active state', () => {
    expect(cssSource).toContain('#empty-state-open-btn:active');
  });
});
