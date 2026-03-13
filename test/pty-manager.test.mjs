import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('pty-manager', () => {
  let mock, manager;

  beforeEach(() => {
    mock = createMockPty();
    manager = createManager(mock.module);
  });

  describe('spawn', () => {
    it('spawns a PTY process with correct arguments', () => {
      manager.spawn('tab-1', '/tmp', vi.fn(), vi.fn());
      expect(mock.mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ['-l', '-c', 'claude'],
        expect.objectContaining({
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: '/tmp',
        })
      );
    });

    it('registers onData and onExit callbacks', () => {
      manager.spawn('tab-1', '/tmp', vi.fn(), vi.fn());
      expect(mock.mockProcess.onData).toHaveBeenCalledWith(expect.any(Function));
      expect(mock.mockProcess.onExit).toHaveBeenCalledWith(expect.any(Function));
    });

    it('forwards data from PTY to callback with tab ID', () => {
      const onData = vi.fn();
      manager.spawn('tab-1', '/tmp', onData, vi.fn());
      mock.triggerData('hello world');
      expect(onData).toHaveBeenCalledWith('tab-1', 'hello world');
    });

    it('forwards exit from PTY to callback', () => {
      const onExit = vi.fn();
      manager.spawn('tab-1', '/tmp', vi.fn(), onExit);
      mock.triggerExit(0);
      expect(onExit).toHaveBeenCalledWith('tab-1', 0);
    });
  });

  describe('write', () => {
    it('writes data to the correct PTY', () => {
      manager.spawn('tab-1', '/tmp', vi.fn(), vi.fn());
      manager.write('tab-1', 'input data');
      expect(mock.mockProcess.write).toHaveBeenCalledWith('input data');
    });

    it('does nothing for unknown tab ID', () => {
      manager.write('nonexistent', 'data');
    });
  });

  describe('resize', () => {
    it('resizes the correct PTY', () => {
      manager.spawn('tab-1', '/tmp', vi.fn(), vi.fn());
      manager.resize('tab-1', 120, 40);
      expect(mock.mockProcess.resize).toHaveBeenCalledWith(120, 40);
    });

    it('does nothing for unknown tab ID', () => {
      manager.resize('nonexistent', 120, 40);
    });
  });

  describe('kill', () => {
    it('kills the PTY process', () => {
      manager.spawn('tab-1', '/tmp', vi.fn(), vi.fn());
      manager.kill('tab-1');
      expect(mock.mockProcess.kill).toHaveBeenCalled();
    });

    it('removes the PTY so subsequent writes are no-ops', () => {
      manager.spawn('tab-1', '/tmp', vi.fn(), vi.fn());
      manager.kill('tab-1');
      mock.mockProcess.write.mockClear();
      manager.write('tab-1', 'data');
      expect(mock.mockProcess.write).not.toHaveBeenCalled();
    });

    it('does nothing for unknown tab ID', () => {
      manager.kill('nonexistent');
    });
  });

  describe('killAll', () => {
    it('kills all PTY processes', () => {
      // Need separate mocks for two spawns
      let killCount = 0;
      const mockModule = {
        spawn: vi.fn(() => ({
          onData: vi.fn(),
          onExit: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(() => { killCount++; }),
        })),
      };
      const mgr = createManager(mockModule);
      mgr.spawn('tab-1', '/tmp', vi.fn(), vi.fn());
      mgr.spawn('tab-2', '/tmp', vi.fn(), vi.fn());
      mgr.killAll();
      expect(killCount).toBe(2);
    });
  });
});
