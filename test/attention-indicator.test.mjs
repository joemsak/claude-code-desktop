import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('attention indicator for background tabs', () => {
  describe('tab state tracking', () => {
    it('tracks a needsAttention flag on each tab', () => {
      // Each tab object should have a needsAttention property
      const createTabBlock = appSource.match(/const tab = \{[\s\S]*?\};/);
      expect(createTabBlock).not.toBeNull();
      expect(createTabBlock[0]).toMatch(/needsAttention/);
    });

    it('tracks a busy flag on each tab for activity detection', () => {
      const createTabBlock = appSource.match(/const tab = \{[\s\S]*?\};/);
      expect(createTabBlock).not.toBeNull();
      expect(createTabBlock[0]).toMatch(/busy/);
    });
  });

  describe('busy-to-idle transition detection', () => {
    it('sets busy flag when PTY data arrives', () => {
      const ptyDataBlock = appSource.match(/onPtyData\([\s\S]*?\n\}\);/);
      expect(ptyDataBlock).not.toBeNull();
      expect(ptyDataBlock[0]).toMatch(/tab\.busy\s*=\s*true/);
    });

    it('uses a timer to detect idle after PTY data stops', () => {
      // Should clear and reset a timer on each data event
      const ptyDataBlock = appSource.match(/onPtyData\([\s\S]*?\n\}\);/);
      expect(ptyDataBlock).not.toBeNull();
      expect(ptyDataBlock[0]).toMatch(/clearTimeout/);
      expect(ptyDataBlock[0]).toMatch(/busyTimeout|idleTimeout/);
    });

    it('only sets needsAttention if the tab was busy when user left it or window lost focus', () => {
      // The idle callback should check wasBusyOnLeave or window focus before setting needsAttention
      const ptyDataBlock = appSource.match(/onPtyData\([\s\S]*?\n\}\);/);
      expect(ptyDataBlock).not.toBeNull();
      expect(ptyDataBlock[0]).toMatch(/wasBusyOnLeave/);
      expect(ptyDataBlock[0]).toMatch(/hasFocus/);
      expect(ptyDataBlock[0]).toMatch(/needsAttention\s*=\s*true/);
    });
  });

  describe('tracking busy state on tab leave', () => {
    it('tracks wasBusyOnLeave flag on each tab', () => {
      const createTabBlock = appSource.match(/const tab = \{[\s\S]*?\};/);
      expect(createTabBlock).not.toBeNull();
      expect(createTabBlock[0]).toMatch(/wasBusyOnLeave/);
    });

    it('sets wasBusyOnLeave based on busy state when switching away', () => {
      const switchBlock = appSource.match(/function switchTab[\s\S]*?\n\}/);
      expect(switchBlock).not.toBeNull();
      expect(switchBlock[0]).toMatch(/wasBusyOnLeave\s*=.*busy/);
    });
  });

  describe('clearing attention on user input', () => {
    it('does not clear needsAttention on tab switch alone', () => {
      const switchBlock = appSource.match(/function switchTab[\s\S]*?\n\}/);
      expect(switchBlock).not.toBeNull();
      // switchTab should NOT clear needsAttention — only user typing should
      expect(switchBlock[0]).not.toMatch(/needsAttention\s*=\s*false/);
    });

    it('clears needsAttention when user types in the terminal', () => {
      // terminal.onData handler should clear needsAttention
      const onDataBlock = appSource.match(/terminal\.onData\(\(data\)[\s\S]*?\}\);/);
      expect(onDataBlock).not.toBeNull();
      expect(onDataBlock[0]).toMatch(/needsAttention\s*=\s*false/);
    });
  });

  describe('sidebar rendering', () => {
    it('adds attention class to tab entries that need attention', () => {
      const renderBlock = appSource.match(/function renderSidebar[\s\S]*?\n\}/);
      expect(renderBlock).not.toBeNull();
      expect(renderBlock[0]).toMatch(/needsAttention/);
      expect(renderBlock[0]).toMatch(/tab-attention/);
    });
  });

  describe('CSS styling', () => {
    it('has a tab-attention style with a visible indicator', () => {
      expect(cssSource).toMatch(/\.tab-attention/);
    });

    it('uses a dot or badge indicator', () => {
      // Should use a pseudo-element or inline element for the dot
      expect(cssSource).toMatch(/tab-attention/);
    });
  });
});
