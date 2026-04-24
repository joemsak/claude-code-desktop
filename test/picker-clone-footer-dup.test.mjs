// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPicker } from '../src/renderer/picker.js';

function setupDom() {
  document.body.innerHTML = `
    <div id="picker-overlay" class="hidden">
      <div id="picker-modal">
        <input id="picker-search" />
        <ul id="picker-list"></ul>
      </div>
    </div>
  `;
  return {
    overlay: document.getElementById('picker-overlay'),
    modal: document.getElementById('picker-modal'),
    search: document.getElementById('picker-search'),
    list: document.getElementById('picker-list'),
  };
}

function makePicker() {
  const dom = setupDom();
  const electronAPI = {
    listWorkspaceDirs: vi.fn(async () => [{ name: 'foo', path: '/w/foo' }]),
    getRecentWorkspaces: vi.fn(async () => []),
    parseGitUrl: vi.fn(async () => ({ valid: false })),
  };
  return createPicker({
    dom,
    electronAPI,
    basename: (p) => p.split('/').pop(),
    getHomePath: () => '/home/user',
    getActiveTab: () => null,
    onSelect: vi.fn(),
    onSelectDangerous: vi.fn(),
    onClone: vi.fn(),
    onClose: vi.fn(),
  });
}

async function flush() {
  // Drain microtasks so awaited input-handler work completes.
  await new Promise((r) => setTimeout(r, 0));
}

describe('picker Clone repo footer duplication regression', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('only one #picker-clone-footer exists after typing many characters', async () => {
    const picker = makePicker();
    await picker.open();
    await flush();

    const search = document.getElementById('picker-search');
    for (const ch of 'hello') {
      search.value += ch;
      search.dispatchEvent(new Event('input'));
      await flush();
    }

    const footers = document.querySelectorAll('#picker-clone-footer');
    expect(footers.length).toBe(1);
  });

  it('only one #picker-clone-footer exists after close and reopen', async () => {
    const picker = makePicker();
    await picker.open();
    await flush();

    const search = document.getElementById('picker-search');
    search.value = 'ab';
    search.dispatchEvent(new Event('input'));
    await flush();

    picker.close();
    await picker.open();
    await flush();

    const footers = document.querySelectorAll('#picker-clone-footer');
    expect(footers.length).toBe(1);
  });
});
