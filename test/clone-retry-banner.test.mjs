// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCloneOrchestrator } from '../src/renderer/clone-flow.js';

function makeDeps(overrides = {}) {
  return {
    electronAPI: {
      cloneRepo: vi.fn(async () => ({ ok: true, name: 'foo', path: '/w/foo' })),
      trackWorkspace: vi.fn(),
    },
    createCloningTab: vi.fn((tabId, name) => ({ id: tabId, name })),
    respawnInDir: vi.fn(),
    renderRetryBanner: vi.fn(),
    clearRetryBanner: vi.fn(),
    closeTab: vi.fn(),
    openExistingDir: vi.fn(),
    ...overrides,
  };
}

describe('createCloneOrchestrator', () => {
  let deps, orch;

  beforeEach(() => {
    deps = makeDeps();
    orch = createCloneOrchestrator(deps);
  });

  it('clone(): creates a cloning tab and invokes electronAPI.cloneRepo', async () => {
    const tabId = await orch.clone(
      'git@github.com:foo/bar.git',
      { dangerousMode: false },
    );
    expect(typeof tabId).toBe('string');
    expect(deps.createCloningTab).toHaveBeenCalledWith(tabId, 'foo');
    expect(deps.electronAPI.cloneRepo).toHaveBeenCalledWith({
      tabId,
      url: 'git@github.com:foo/bar.git',
      dangerousMode: false,
    });
  });

  it('isCloning returns true for an active clone tab', async () => {
    const tabId = await orch.clone('git@github.com:foo/bar.git', {});
    expect(orch.isCloning(tabId)).toBe(true);
    expect(orch.isCloning('unknown-tab')).toBe(false);
  });

  it('handlePtyExit(code=0): respawns in the cloned dir and tracks workspace', async () => {
    const tabId = await orch.clone(
      'git@github.com:foo/bar.git',
      { dangerousMode: false },
    );
    const handled = orch.handlePtyExit(tabId, 0);
    expect(handled).toBe(true);
    expect(deps.respawnInDir).toHaveBeenCalledWith(tabId, '/w/foo', {
      dangerousMode: false,
    });
    expect(deps.electronAPI.trackWorkspace).toHaveBeenCalledWith('/w/foo');
    expect(orch.isCloning(tabId)).toBe(false);
  });

  it('handlePtyExit(code=0): passes dangerousMode through to respawn', async () => {
    const tabId = await orch.clone('git@github.com:foo/bar.git', {
      dangerousMode: true,
    });
    orch.handlePtyExit(tabId, 0);
    expect(deps.respawnInDir).toHaveBeenCalledWith(tabId, '/w/foo', {
      dangerousMode: true,
    });
  });

  it('handlePtyExit(code!=0): renders retry banner and keeps cloning entry', async () => {
    const tabId = await orch.clone('git@github.com:foo/bar.git', {
      dangerousMode: false,
    });
    orch.handlePtyExit(tabId, 128);
    expect(deps.renderRetryBanner).toHaveBeenCalledTimes(1);
    const [gotTabId, retryFn, closeFn] = deps.renderRetryBanner.mock.calls[0];
    expect(gotTabId).toBe(tabId);
    expect(typeof retryFn).toBe('function');
    expect(typeof closeFn).toBe('function');
    expect(orch.isCloning(tabId)).toBe(true);
  });

  it('retry function reinvokes cloneRepo with the same args and clears the banner', async () => {
    const tabId = await orch.clone('git@github.com:foo/bar.git', {
      dangerousMode: true,
    });
    deps.electronAPI.cloneRepo.mockClear();
    orch.handlePtyExit(tabId, 1);
    const [, retry] = deps.renderRetryBanner.mock.calls[0];
    await retry();
    expect(deps.electronAPI.cloneRepo).toHaveBeenCalledWith({
      tabId,
      url: 'git@github.com:foo/bar.git',
      dangerousMode: true,
    });
    expect(deps.clearRetryBanner).toHaveBeenCalledWith(tabId);
  });

  it('close function from retry banner removes the cloning entry and calls closeTab', async () => {
    const tabId = await orch.clone('git@github.com:foo/bar.git', {});
    orch.handlePtyExit(tabId, 1);
    const [, , closeFn] = deps.renderRetryBanner.mock.calls[0];
    closeFn();
    expect(deps.closeTab).toHaveBeenCalledWith(tabId);
    expect(orch.isCloning(tabId)).toBe(false);
  });

  it('handlePtyExit returns false for a non-cloning tab', () => {
    expect(orch.handlePtyExit('random', 0)).toBe(false);
    expect(deps.respawnInDir).not.toHaveBeenCalled();
  });

  it('clone(): returns undefined when cloneRepo rejects (bad URL)', async () => {
    deps.electronAPI.cloneRepo.mockResolvedValue({
      ok: false,
      error: 'Not a valid git URL',
    });
    const tabId = await orch.clone('file:///etc/passwd', {});
    expect(tabId).toBeUndefined();
    expect(deps.createCloningTab).not.toHaveBeenCalled();
  });

  it('clone(): when target already exists, opens it and skips the clone tab', async () => {
    deps.electronAPI.cloneRepo.mockResolvedValue({
      ok: true,
      alreadyExists: true,
      name: 'foo',
      path: '/w/foo',
    });
    const result = await orch.clone('git@github.com:joemsak/foo.git', {
      dangerousMode: true,
    });
    expect(deps.openExistingDir).toHaveBeenCalledWith('/w/foo', {
      dangerousMode: true,
    });
    expect(deps.createCloningTab).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
