import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const tmpDir = path.join(os.tmpdir(), 'claude-code-desktop-test-' + Date.now());
const configDir = path.join(tmpDir, '.config', 'claude-code-desktop');
const sessionFile = path.join(configDir, 'sessions.json');

// Use the factory to create a store pointing at our temp dir
const { createStore } = require('../src/main/session-store');
const store = createStore(tmpDir);

describe('session-store', () => {
  beforeEach(() => {
    fs.mkdirSync(configDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('returns null when no session file exists', () => {
      expect(store.load()).toBeNull();
    });

    it('returns null when session file is corrupted JSON', () => {
      fs.writeFileSync(sessionFile, 'not json{{{');
      expect(store.load()).toBeNull();
    });

    it('returns null when session has wrong version', () => {
      fs.writeFileSync(sessionFile, JSON.stringify({ version: 99, tabs: [{ directory: tmpDir }] }));
      expect(store.load()).toBeNull();
    });

    it('loads session with empty tabs (preserves recentWorkspaces)', () => {
      const data = { version: 1, tabs: [], recentWorkspaces: [{ path: '/foo', count: 3, lastUsed: 1 }] };
      fs.writeFileSync(sessionFile, JSON.stringify(data));
      const result = store.load();
      expect(result).not.toBeNull();
      expect(result.tabs).toEqual([]);
      expect(result.recentWorkspaces).toHaveLength(1);
    });

    it('returns null when tabs is not an array', () => {
      fs.writeFileSync(sessionFile, JSON.stringify({ version: 1, tabs: 'not-array' }));
      expect(store.load()).toBeNull();
    });

    it('loads valid session data', () => {
      const data = {
        version: 1,
        window: { x: 100, y: 200, width: 1200, height: 800 },
        sidebarWidth: 250,
        tabs: [{ directory: tmpDir, customName: null }],
        activeTabIndex: 0,
      };
      fs.writeFileSync(sessionFile, JSON.stringify(data));
      expect(store.load()).toEqual(data);
    });

    it('does not persist _originalDir from a previous load into saved data', () => {
      // Simulate: load finds a missing dir, adds _originalDir
      const data = {
        version: 1,
        tabs: [{ directory: '/nonexistent/path/xyz', customName: 'old-project' }],
        activeTabIndex: 0,
      };
      fs.writeFileSync(sessionFile, JSON.stringify(data));
      const loaded = store.load();
      expect(loaded.tabs[0]._originalDir).toBe('/nonexistent/path/xyz');

      // Now save the loaded data back — _originalDir should be stripped
      store.save(loaded);
      const reloaded = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      expect(reloaded.tabs[0]._originalDir).toBeUndefined();
    });

    it('falls back to home dir when tab directory does not exist', () => {
      const data = {
        version: 1,
        tabs: [{ directory: '/nonexistent/path/12345', customName: 'my-project' }],
        activeTabIndex: 0,
      };
      fs.writeFileSync(sessionFile, JSON.stringify(data));
      const result = store.load();
      expect(result.tabs[0].directory).toBe(tmpDir);
      expect(result.tabs[0].customName).toBe('my-project');
      expect(result.tabs[0]._originalDir).toBe('/nonexistent/path/12345');
    });

    it('preserves existing directories as-is', () => {
      const data = {
        version: 1,
        tabs: [{ directory: tmpDir, customName: null }],
        activeTabIndex: 0,
      };
      fs.writeFileSync(sessionFile, JSON.stringify(data));
      const result = store.load();
      expect(result.tabs[0].directory).toBe(tmpDir);
      expect(result.tabs[0]._originalDir).toBeUndefined();
    });
  });

  describe('save', () => {
    it('creates config directory and writes session file', () => {
      fs.rmSync(configDir, { recursive: true, force: true });
      const data = {
        version: 1,
        window: { x: 0, y: 0, width: 800, height: 600 },
        sidebarWidth: 200,
        tabs: [{ directory: tmpDir, customName: null }],
        activeTabIndex: 0,
      };
      store.save(data);
      expect(fs.existsSync(sessionFile)).toBe(true);
      const written = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      expect(written).toEqual(data);
    });

    it('preserves recentWorkspaces when saving tabs', () => {
      // trackWorkspace writes recentWorkspaces to the file
      store.trackWorkspace('/path/preserve-test');
      const before = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      expect(before.recentWorkspaces).toHaveLength(1);

      // save() writes tabs — should not lose recentWorkspaces
      store.save({ version: 1, tabs: [{ directory: tmpDir }], activeTabIndex: 0 });
      const after = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      expect(after.recentWorkspaces).toHaveLength(1);
      expect(after.recentWorkspaces[0].path).toBe('/path/preserve-test');
    });

    it('overwrites existing session file', () => {
      store.save({ version: 1, tabs: [{ directory: '/a' }], activeTabIndex: 0 });
      store.save({ version: 1, tabs: [{ directory: '/b' }], activeTabIndex: 0 });
      const written = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      expect(written.tabs[0].directory).toBe('/b');
    });
  });

  describe('DEFAULT_SESSION', () => {
    it('has empty tabs array so first launch opens the picker', () => {
      expect(store.DEFAULT_SESSION.version).toBe(1);
      expect(store.DEFAULT_SESSION.tabs).toEqual([]);
      expect(store.DEFAULT_SESSION.activeTabIndex).toBe(0);
      expect(store.DEFAULT_SESSION.sidebarWidth).toBe(200);
    });

    it('has empty recentWorkspaces array', () => {
      expect(store.DEFAULT_SESSION.recentWorkspaces).toEqual([]);
    });
  });

  describe('trackWorkspace', () => {
    it('adds a new workspace with count 1', () => {
      store.trackWorkspace('/path/add-test');
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      expect(data.recentWorkspaces).toHaveLength(1);
      expect(data.recentWorkspaces[0].path).toBe('/path/add-test');
      expect(data.recentWorkspaces[0].count).toBe(1);
      expect(data.recentWorkspaces[0].lastUsed).toBeDefined();
    });

    it('increments count for an existing workspace', () => {
      store.trackWorkspace('/path/incr-test');
      store.trackWorkspace('/path/incr-test');
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      const entry = data.recentWorkspaces.find((r) => r.path === '/path/incr-test');
      expect(entry.count).toBe(2);
    });

    it('most recently tracked workspace is first', () => {
      store.trackWorkspace('/path/sort-a');
      store.trackWorkspace('/path/sort-b');
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      // sort-b was tracked last, so it should be first (or tied)
      const paths = data.recentWorkspaces.map((r) => r.path);
      expect(paths).toContain('/path/sort-a');
      expect(paths).toContain('/path/sort-b');
      // The last-tracked item should be at index 0 or tied at same timestamp
      expect(data.recentWorkspaces[0].path).toBe('/path/sort-b');
    });
  });
});
