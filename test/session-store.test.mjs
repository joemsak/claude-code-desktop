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

    it('returns null when session has empty tabs array', () => {
      fs.writeFileSync(sessionFile, JSON.stringify({ version: 1, tabs: [] }));
      expect(store.load()).toBeNull();
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

    it('overwrites existing session file', () => {
      store.save({ version: 1, tabs: [{ directory: '/a' }], activeTabIndex: 0 });
      store.save({ version: 1, tabs: [{ directory: '/b' }], activeTabIndex: 0 });
      const written = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      expect(written.tabs[0].directory).toBe('/b');
    });
  });

  describe('DEFAULT_SESSION', () => {
    it('has correct structure', () => {
      expect(store.DEFAULT_SESSION.version).toBe(1);
      expect(store.DEFAULT_SESSION.tabs).toHaveLength(1);
      expect(store.DEFAULT_SESSION.tabs[0].directory).toBe(tmpDir);
      expect(store.DEFAULT_SESSION.tabs[0].customName).toBeNull();
      expect(store.DEFAULT_SESSION.activeTabIndex).toBe(0);
      expect(store.DEFAULT_SESSION.sidebarWidth).toBe(200);
    });
  });
});
