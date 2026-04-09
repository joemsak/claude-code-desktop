import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');
const _appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('welcome page shift-dangerous hint', () => {
  it('has a shift-hint element in the empty state HTML', () => {
    expect(htmlSource).toContain('id="empty-state-shift-hint"');
  });

  it('has CSS for the shift hint', () => {
    expect(cssSource).toContain('.empty-state-shift-hint');
  });
});
