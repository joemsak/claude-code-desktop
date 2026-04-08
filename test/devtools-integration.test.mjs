import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf-8');

describe('claude-devtools integration', () => {
  it('has a menu item for opening Claude DevTools', () => {
    expect(mainSource).toContain('Claude DevTools');
  });

  it('uses Cmd+Shift+D accelerator', () => {
    expect(mainSource).toContain('CmdOrCtrl+Shift+D');
  });

  it('launches the devtools app via shell', () => {
    expect(mainSource).toContain('claude-devtools');
  });
});
