import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHookConfig } from '../src/main/hook-config.js';

describe('hook config', () => {
  let tmpDir;
  let config;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-config-test-'));
    config = createHookConfig(8888);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes hooks to project-level settings.local.json', () => {
    config.install(tmpDir, 'tab-1', 'project');
    const settingsPath = path.join(tmpDir, '.claude', 'settings.local.json');
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.Stop).toBeDefined();
    expect(settings.hooks.Stop[0].hooks[0].url).toContain('ccd-tab-1');
  });

  it('merges with existing settings without overwriting', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify({ hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'echo existing' }] }] } })
    );

    config.install(tmpDir, 'tab-1', 'project');
    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.local.json'), 'utf-8'));

    // Should have both the existing hook and our hook
    expect(settings.hooks.Stop.length).toBe(2);
    expect(settings.hooks.Stop[0].hooks[0].command).toBe('echo existing');
    expect(settings.hooks.Stop[1].hooks[0].url).toContain('ccd-tab-1');
  });

  it('removes only our hooks on uninstall', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify({ hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'echo existing' }] }] } })
    );

    config.install(tmpDir, 'tab-1', 'project');
    config.uninstall(tmpDir, 'tab-1', 'project');

    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.local.json'), 'utf-8'));
    expect(settings.hooks.Stop.length).toBe(1);
    expect(settings.hooks.Stop[0].hooks[0].command).toBe('echo existing');
  });

  it('cleanupStale removes all ccd hooks from a settings file', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify({
        hooks: {
          Stop: [
            { matcher: '', hooks: [{ type: 'command', command: 'echo keep' }] },
            { matcher: '', hooks: [{ type: 'http', url: 'http://localhost:9999/hooks/ccd-old-tab-1' }] },
            { matcher: '', hooks: [{ type: 'http', url: 'http://localhost:8888/hooks/ccd-old-tab-2' }] },
          ],
          PreToolUse: [
            { matcher: '', hooks: [{ type: 'http', url: 'http://localhost:9999/hooks/ccd-old-tab-1' }] },
          ],
        },
      })
    );

    config.cleanupStale(tmpDir, 'project');

    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.local.json'), 'utf-8'));
    expect(settings.hooks.Stop.length).toBe(1);
    expect(settings.hooks.Stop[0].hooks[0].command).toBe('echo keep');
    expect(settings.hooks.PreToolUse.length).toBe(0);
  });

  it('writes hooks to global settings when scope is global', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-config-home-'));
    config = createHookConfig(8888, homeDir);
    config.install(tmpDir, 'tab-2', 'global');

    const settingsPath = path.join(homeDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(settings.hooks.Stop[0].hooks[0].url).toContain('ccd-tab-2');

    fs.rmSync(homeDir, { recursive: true, force: true });
  });
});
