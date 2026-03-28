import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('status dot cross-fade', () => {
  it('has a dotAppear keyframe animation', () => {
    expect(cssSource).toContain('@keyframes dotAppear');
  });

  it('status-dot uses appear animation', () => {
    const dotBlock = cssSource.match(/\.status-dot\s*\{[^}]*\}/);
    expect(dotBlock).not.toBeNull();
    expect(dotBlock[0]).toContain('animation');
  });
});
