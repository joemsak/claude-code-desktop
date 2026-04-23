import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  createGitParseUrlHandler,
  createGitCloneHandler,
} = require('../src/main/git-clone-handlers');

function makeDeps(overrides = {}) {
  return {
    ptyManager: { spawn: vi.fn() },
    getWorkspaceDir: () => '/Users/joe/workspace',
    pathExists: () => false,
    send: vi.fn(),
    ...overrides,
  };
}

describe('git:parse-url handler', () => {
  it('returns valid + name for a real URL', () => {
    const handler = createGitParseUrlHandler();
    const r = handler(null, 'git@github.com:joemsak/foo.git');
    expect(r.valid).toBe(true);
    expect(r.name).toBe('foo');
  });

  it('returns invalid for a bad URL', () => {
    const handler = createGitParseUrlHandler();
    expect(handler(null, 'file:///etc/passwd').valid).toBe(false);
    expect(handler(null, '').valid).toBe(false);
  });
});

describe('git:clone handler', () => {
  it('spawns a git-clone PTY for a valid URL and returns ok+name+path', () => {
    const deps = makeDeps();
    const handler = createGitCloneHandler(deps);
    const result = handler(
      { sender: { isDestroyed: () => false, send: vi.fn() } },
      { tabId: 'tab-1', url: 'git@github.com:joemsak/foo.git', dangerousMode: false },
    );
    expect(result.ok).toBe(true);
    expect(result.name).toBe('foo');
    expect(result.path).toBe('/Users/joe/workspace/foo');
    expect(deps.ptyManager.spawn).toHaveBeenCalledTimes(1);
    const call = deps.ptyManager.spawn.mock.calls[0];
    expect(call[0]).toBe('tab-1');
    expect(call[1]).toBe('/Users/joe/workspace');
    expect(typeof call[2]).toBe('function');
    expect(typeof call[3]).toBe('function');
    expect(call[4]).toEqual({
      dangerousMode: false,
      command: {
        type: 'git-clone',
        url: 'git@github.com:joemsak/foo.git',
        name: 'foo',
      },
    });
  });

  it('forwards pty data to sender over pty:data channel', () => {
    const deps = makeDeps();
    const send = vi.fn();
    const event = { sender: { isDestroyed: () => false, send } };
    const handler = createGitCloneHandler(deps);
    handler(event, {
      tabId: 'tab-1',
      url: 'git@github.com:joemsak/foo.git',
      dangerousMode: false,
    });
    const onData = deps.ptyManager.spawn.mock.calls[0][2];
    onData('tab-1', 'Cloning into foo...\n');
    expect(send).toHaveBeenCalledWith('pty:data', 'tab-1', 'Cloning into foo...\n');
  });

  it('forwards pty exit to sender over pty:exit channel', () => {
    const deps = makeDeps();
    const send = vi.fn();
    const event = { sender: { isDestroyed: () => false, send } };
    const handler = createGitCloneHandler(deps);
    handler(event, {
      tabId: 'tab-1',
      url: 'git@github.com:joemsak/foo.git',
      dangerousMode: false,
    });
    const onExit = deps.ptyManager.spawn.mock.calls[0][3];
    onExit('tab-1', 0);
    expect(send).toHaveBeenCalledWith('pty:exit', 'tab-1', 0);
  });

  it('returns ok:false and does not spawn for a bad URL', () => {
    const deps = makeDeps();
    const handler = createGitCloneHandler(deps);
    const result = handler(
      { sender: { isDestroyed: () => false, send: vi.fn() } },
      { tabId: 'tab-1', url: 'file:///etc/passwd', dangerousMode: false },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(deps.ptyManager.spawn).not.toHaveBeenCalled();
  });

  it('rejects missing/invalid tabId', () => {
    const deps = makeDeps();
    const handler = createGitCloneHandler(deps);
    const r1 = handler(
      { sender: { isDestroyed: () => false, send: vi.fn() } },
      { url: 'git@github.com:joemsak/foo.git' },
    );
    expect(r1.ok).toBe(false);
    expect(deps.ptyManager.spawn).not.toHaveBeenCalled();
  });

  it('passes dangerousMode through to spawn options', () => {
    const deps = makeDeps();
    const handler = createGitCloneHandler(deps);
    handler(
      { sender: { isDestroyed: () => false, send: vi.fn() } },
      { tabId: 'tab-1', url: 'git@github.com:foo/bar.git', dangerousMode: true },
    );
    const opts = deps.ptyManager.spawn.mock.calls[0][4];
    expect(opts.dangerousMode).toBe(true);
  });

  it('returns alreadyExists and does not spawn when target dir exists', () => {
    const deps = makeDeps({
      pathExists: (p) => p === '/Users/joe/workspace/foo',
    });
    const handler = createGitCloneHandler(deps);
    const result = handler(
      { sender: { isDestroyed: () => false, send: vi.fn() } },
      { tabId: 'tab-1', url: 'git@github.com:joemsak/foo.git' },
    );
    expect(result).toEqual({
      ok: true,
      alreadyExists: true,
      name: 'foo',
      path: '/Users/joe/workspace/foo',
    });
    expect(deps.ptyManager.spawn).not.toHaveBeenCalled();
  });
});
