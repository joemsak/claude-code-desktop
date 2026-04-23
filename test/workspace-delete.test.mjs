import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const tmpDir = path.join(os.tmpdir(), 'claude-code-desktop-delete-' + Date.now());
const configDir = path.join(tmpDir, '.config', 'claude-code-desktop');
const sessionFile = path.join(configDir, 'sessions.json');

const { createStore } = require('../src/main/session-store');
const store = createStore(tmpDir);

describe('session-store removeRecentWorkspace', () => {
  beforeEach(() => {
    fs.mkdirSync(configDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes the matching entry from recentWorkspaces', () => {
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({
        version: 1,
        tabs: [],
        recentWorkspaces: [
          { path: '/a', count: 1, lastUsed: 1 },
          { path: '/b', count: 2, lastUsed: 2 },
          { path: '/c', count: 3, lastUsed: 3 },
        ],
      }),
    );
    store.removeRecentWorkspace('/b');
    const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    expect(data.recentWorkspaces.map((r) => r.path)).toEqual(['/a', '/c']);
  });

  it('is a no-op when the path is not in recents', () => {
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({
        version: 1,
        tabs: [],
        recentWorkspaces: [{ path: '/a', count: 1, lastUsed: 1 }],
      }),
    );
    store.removeRecentWorkspace('/nonexistent');
    const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    expect(data.recentWorkspaces).toHaveLength(1);
  });

  it('is a no-op when session file does not exist', () => {
    expect(() => store.removeRecentWorkspace('/a')).not.toThrow();
  });
});

describe('workspace:trash IPC handler', () => {
  const { createTrashWorkspaceHandler } = require(
    '../src/main/workspace-delete-handlers',
  );

  function makeDeps(overrides = {}) {
    return {
      trashItem: vi.fn(async () => {}),
      removeRecentWorkspace: vi.fn(),
      homedir: () => '/Users/joe',
      ...overrides,
    };
  }

  it('trashes the path and removes it from recents', async () => {
    const deps = makeDeps();
    const handler = createTrashWorkspaceHandler(deps);
    const result = await handler(null, '/Users/joe/workspace/foo');
    expect(deps.trashItem).toHaveBeenCalledWith('/Users/joe/workspace/foo');
    expect(deps.removeRecentWorkspace).toHaveBeenCalledWith(
      '/Users/joe/workspace/foo',
    );
    expect(result).toEqual({ ok: true });
  });

  it('refuses to trash the home directory', async () => {
    const deps = makeDeps();
    const handler = createTrashWorkspaceHandler(deps);
    const result = await handler(null, '/Users/joe');
    expect(result.ok).toBe(false);
    expect(deps.trashItem).not.toHaveBeenCalled();
  });

  it('refuses to trash /', async () => {
    const deps = makeDeps();
    const handler = createTrashWorkspaceHandler(deps);
    const result = await handler(null, '/');
    expect(result.ok).toBe(false);
    expect(deps.trashItem).not.toHaveBeenCalled();
  });

  it('refuses non-absolute paths', async () => {
    const deps = makeDeps();
    const handler = createTrashWorkspaceHandler(deps);
    const result = await handler(null, 'relative/path');
    expect(result.ok).toBe(false);
    expect(deps.trashItem).not.toHaveBeenCalled();
  });

  it('refuses empty / invalid input', async () => {
    const deps = makeDeps();
    const handler = createTrashWorkspaceHandler(deps);
    expect((await handler(null, '')).ok).toBe(false);
    expect((await handler(null, null)).ok).toBe(false);
    expect((await handler(null, 42)).ok).toBe(false);
    expect(deps.trashItem).not.toHaveBeenCalled();
  });

  it('returns ok:false with error when trashItem throws', async () => {
    const deps = makeDeps({
      trashItem: vi.fn(async () => {
        throw new Error('no permission');
      }),
    });
    const handler = createTrashWorkspaceHandler(deps);
    const result = await handler(null, '/Users/joe/workspace/foo');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(deps.removeRecentWorkspace).not.toHaveBeenCalled();
  });
});
