import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createManager } = require('../src/main/pty-manager');

function createMockPty() {
  let onDataCb, onExitCb;
  const mockProcess = {
    onData: vi.fn((cb) => { onDataCb = cb; }),
    onExit: vi.fn((cb) => { onExitCb = cb; }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };
  const mockSpawn = vi.fn(() => mockProcess);
  return {
    module: { spawn: mockSpawn },
    mockSpawn,
    mockProcess,
    triggerData: (data) => onDataCb(data),
    triggerExit: (exitCode) => onExitCb({ exitCode }),
  };
}

describe('pty-manager custom command', () => {
  let mock, hook, manager;

  beforeEach(() => {
    mock = createMockPty();
    hook = vi.fn();
    manager = createManager(mock.module, vi.fn(), hook);
  });

  it('spawns git with clone args when command.type is git-clone', () => {
    manager.spawn('tab-clone', '/tmp/workspace', vi.fn(), vi.fn(), {
      command: {
        type: 'git-clone',
        url: 'git@github.com:joemsak/foo.git',
        name: 'foo',
      },
    });
    const [cmd, args, opts] = mock.mockSpawn.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['clone', 'git@github.com:joemsak/foo.git', 'foo']);
    expect(opts.cwd).toBe('/tmp/workspace');
  });

  it('does not invoke the pre-spawn hook for git-clone commands', () => {
    manager.spawn('tab-clone', '/tmp', vi.fn(), vi.fn(), {
      command: {
        type: 'git-clone',
        url: 'git@github.com:foo/bar.git',
        name: 'bar',
      },
    });
    expect(hook).not.toHaveBeenCalled();
  });

  it('does not wrap in a shell or reference claude for git-clone', () => {
    manager.spawn('tab-clone', '/tmp', vi.fn(), vi.fn(), {
      command: {
        type: 'git-clone',
        url: 'git@github.com:foo/bar.git',
        name: 'bar',
      },
    });
    const [cmd, args] = mock.mockSpawn.mock.calls[0];
    expect(cmd).not.toBe('/bin/zsh');
    expect(cmd).not.toMatch(/sh$/);
    for (const a of args) {
      expect(a).not.toContain('claude');
      expect(a).not.toContain('source');
    }
  });

  it('forwards data and exit callbacks with the tab id', () => {
    const onData = vi.fn();
    const onExit = vi.fn();
    manager.spawn('tab-clone', '/tmp', onData, onExit, {
      command: {
        type: 'git-clone',
        url: 'git@github.com:foo/bar.git',
        name: 'bar',
      },
    });
    mock.triggerData('Cloning into bar...\n');
    mock.triggerExit(0);
    expect(onData).toHaveBeenCalledWith('tab-clone', 'Cloning into bar...\n');
    expect(onExit).toHaveBeenCalledWith('tab-clone', 0);
  });

  it('still uses claude launcher when no command option is supplied', () => {
    manager.spawn('tab-normal', '/tmp', vi.fn(), vi.fn());
    const [cmd, args] = mock.mockSpawn.mock.calls[0];
    expect(cmd).toMatch(/sh$|zsh$/);
    const inline = args[args.length - 1];
    expect(inline).toContain('exec claude');
  });

  it('kill works on a clone PTY', () => {
    manager.spawn('tab-clone', '/tmp', vi.fn(), vi.fn(), {
      command: {
        type: 'git-clone',
        url: 'git@github.com:foo/bar.git',
        name: 'bar',
      },
    });
    manager.kill('tab-clone');
    expect(mock.mockProcess.kill).toHaveBeenCalled();
  });
});
