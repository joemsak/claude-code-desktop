import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');

describe('scroll behavior — root cause fixes', () => {
  describe('no onScroll-based atBottom tracking (race condition fix)', () => {
    it('does not use terminal.onScroll to track atBottom', () => {
      // onScroll fires with intermediate values during rapid writes,
      // corrupting the atBottom flag. We must NOT use it for scroll tracking.
      expect(appSource).not.toMatch(/terminal\.onScroll\s*\(/);
    });

    it('has an isAtBottom helper that checks synchronously', () => {
      // Must check viewportY >= baseY synchronously at point of use
      expect(appSource).toMatch(/function isAtBottom\b/);
      expect(appSource).toMatch(/viewportY\s*>=\s*.*baseY/);
    });
  });

  describe('onPtyData uses sticky atBottom flag (rapid-write race fix)', () => {
    it('onPtyData uses tab.atBottom instead of isAtBottom() call', () => {
      // During rapid writes (e.g. thinking animation), isAtBottom() races with
      // pending scrollToBottom() callbacks — previous write added content but
      // scrollToBottom hasn't fired yet, so isAtBottom() returns false.
      // Using tab.atBottom (user-intent flag) avoids this race entirely.
      const ptyDataBlock = appSource.match(/onPtyData\([\s\S]*?\n\}\);/);
      expect(ptyDataBlock).not.toBeNull();
      const handler = ptyDataBlock[0];
      expect(handler).toMatch(/tab\.atBottom/);
      // Actual code lines (not comments) must not call isAtBottom()
      const codeLines = handler.split('\n').filter(l => !l.trim().startsWith('//'));
      expect(codeLines.join('\n')).not.toMatch(/isAtBottom\s*\(/);
    });

    it('tracks user scroll intent via wheel events on the terminal', () => {
      // Wheel events detect actual user interaction, unlike onScroll which
      // fires for both programmatic and user scrolls. After a wheel event,
      // we update tab.atBottom based on actual position.
      expect(appSource).toMatch(/wheel/);
      expect(appSource).toMatch(/tab\.atBottom\s*=\s*isAtBottom/);
    });
  });

  describe('no scrollToBottom on inactive/hidden tabs (viewport corruption fix)', () => {
    it('onPtyData only scrolls the active tab', () => {
      // Writing to a display:none terminal corrupts xterm viewport cache
      // (_lastScrollTop becomes 0). Must skip scrollToBottom for inactive tabs.
      const ptyDataBlock = appSource.match(/onPtyData\([\s\S]*?\n\}\);/);
      expect(ptyDataBlock).not.toBeNull();
      const handler = ptyDataBlock[0];
      expect(handler).toMatch(/activeTabId/);
    });
  });

  describe('refitActiveTerminal checks scroll synchronously before fit', () => {
    it('captures scroll state before calling fit()', () => {
      const refitBlock = appSource.match(/function refitActiveTerminal[\s\S]*?\n\}/);
      expect(refitBlock).not.toBeNull();
      const refitCode = refitBlock[0];
      // Must capture isAtBottom BEFORE fit(), not rely on stale flag
      const fitIndex = refitCode.indexOf('.fit()');
      const atBottomIndex = refitCode.indexOf('isAtBottom');
      expect(atBottomIndex).toBeGreaterThan(-1);
      expect(atBottomIndex).toBeLessThan(fitIndex);
    });
  });

  describe('sidebar resize is throttled (layout thrashing fix)', () => {
    it('does not call refitActiveTerminal directly in mousemove', () => {
      // Calling fit() on every mousemove pixel causes layout thrashing
      // and scroll position corruption. Must throttle with rAF.
      const mousemoveBlock = appSource.match(/mousemove[\s\S]*?\n\}\);/);
      expect(mousemoveBlock).not.toBeNull();
      const handler = mousemoveBlock[0];
      expect(handler).toMatch(/requestAnimationFrame/);
    });
  });

  describe('switchTab snapshots scroll state for outgoing tab', () => {
    it('captures atBottom for the previous tab before switching', () => {
      const switchBlock = appSource.match(/function switchTab[\s\S]*?\n\}/);
      expect(switchBlock).not.toBeNull();
      const switchCode = switchBlock[0];
      // Must snapshot the outgoing tab's scroll position before deactivating
      expect(switchCode).toMatch(/isAtBottom/);
    });
  });
});
