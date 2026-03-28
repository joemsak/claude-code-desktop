import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('active tab left accent', () => {
  it('has a left border on active tab entry', () => {
    expect(cssSource).toContain('border-left');
    expect(cssSource).toContain('#89b4fa');
  });
});
