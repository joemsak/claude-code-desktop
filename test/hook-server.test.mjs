import { describe, it, expect, beforeEach } from 'vitest';
import { createHookServer } from '../src/main/hook-server.js';

describe('hook server', () => {
  let server;

  beforeEach(() => {
    server = createHookServer();
  });

  it('starts on a random port', async () => {
    const port = await server.start();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
    await server.stop();
  });

  it('tracks tab state transitions from hook events', async () => {
    const port = await server.start();
    const tabId = 'test-tab-1';

    // UserPromptSubmit → working
    const res1 = await fetch(`http://localhost:${port}/hooks/ccd-${tabId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 's1' }),
    });
    expect(res1.ok).toBe(true);
    expect(server.getState(tabId)).toBe('working');

    // Stop → idle
    const res2 = await fetch(`http://localhost:${port}/hooks/ccd-${tabId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'Stop', session_id: 's1' }),
    });
    expect(res2.ok).toBe(true);
    expect(server.getState(tabId)).toBe('idle');

    await server.stop();
  });

  it('sets state to working on PreToolUse', async () => {
    const port = await server.start();
    const tabId = 'test-tab-2';

    await fetch(`http://localhost:${port}/hooks/ccd-${tabId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Bash' }),
    });
    expect(server.getState(tabId)).toBe('working');

    await server.stop();
  });

  it('sets state to waiting on Notification', async () => {
    const port = await server.start();
    const tabId = 'test-tab-3';

    await fetch(`http://localhost:${port}/hooks/ccd-${tabId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'Notification', session_id: 's1' }),
    });
    expect(server.getState(tabId)).toBe('waiting');

    await server.stop();
  });

  it('calls onStateChange callback', async () => {
    const changes = [];
    server = createHookServer((tabId, state) => changes.push({ tabId, state }));
    const port = await server.start();
    const tabId = 'test-tab-4';

    await fetch(`http://localhost:${port}/hooks/ccd-${tabId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 's1' }),
    });

    expect(changes).toEqual([{ tabId: 'test-tab-4', state: 'working' }]);

    await server.stop();
  });

  it('returns null state for unknown tabs', () => {
    expect(server.getState('nonexistent')).toBeNull();
  });

  it('cleans up tab state', async () => {
    const port = await server.start();
    const tabId = 'test-tab-5';

    await fetch(`http://localhost:${port}/hooks/ccd-${tabId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'Stop', session_id: 's1' }),
    });
    expect(server.getState(tabId)).toBe('idle');

    server.removeTab(tabId);
    expect(server.getState(tabId)).toBeNull();

    await server.stop();
  });
});
