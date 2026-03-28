import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('peek panel slide animation', () => {
  it('has a slideIn keyframe animation', () => {
    expect(cssSource).toContain('@keyframes slideIn');
  });

  it('peek panel uses slide animation', () => {
    const peekBlock = cssSource.match(/#peek-panel\s*\{[^}]*\}/);
    expect(peekBlock).not.toBeNull();
    expect(peekBlock[0]).toContain('animation');
  });
});
