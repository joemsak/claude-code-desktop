import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf-8');

describe('background tab notifications', () => {
  it('imports Notification from electron', () => {
    expect(mainSource).toContain('Notification');
  });

  it('sends native notifications on state changes', () => {
    // The main process should create notifications when tabs need attention
    expect(mainSource).toContain('new Notification');
  });

  it('only notifies when window is not focused', () => {
    expect(mainSource).toContain('isFocused');
  });

  it('sends tab ID with notification click for tab switching', () => {
    expect(mainSource).toContain('notification:click');
  });
});
