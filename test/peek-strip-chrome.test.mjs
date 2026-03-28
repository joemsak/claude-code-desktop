import { describe, it, expect } from 'vitest';
import { stripTuiChrome } from '../src/renderer/strip-tui-chrome.js';

describe('stripTuiChrome', () => {
  it('removes full Claude Code TUI chrome from the bottom', () => {
    const lines = [
      'Some output text',
      'More output',
      '─────────────────────────────────────────',
      '❯',
      '──────',
      '⏵⏵ accept edits on (shift+tab to cycle)',
      'Opus 4.6 (1M context)   ctx: 100K/1M (10%)   📂 project   ⎇ main*',
    ];
    const result = stripTuiChrome(lines);
    expect(result).toEqual(['Some output text', 'More output']);
  });

  it('strips everything after prompt box including unknown statusbar lines', () => {
    const lines = [
      'Some output text',
      '─────────────────────────────────────────',
      '❯',
      '─────────────────────────────────────────',
      '   Opus 4.6 (1M context)   ctx: 0/1M   📂 zenpayroll   ⎇ js/rails-8.1-upgrade',
      '  PR #324225',
      '  some-future-statusbar-thing',
    ];
    const result = stripTuiChrome(lines);
    expect(result).toEqual(['Some output text']);
  });

  it('strips prompt box with > symbol', () => {
    const lines = [
      'output',
      '──────────────────────────',
      '>',
      '──────────────────────────',
    ];
    const result = stripTuiChrome(lines);
    expect(result).toEqual(['output']);
  });

  it('strips prompt box with trailing empties before it', () => {
    const lines = [
      'output',
      '',
      '──────────────────────────',
      '❯',
      '──────',
    ];
    const result = stripTuiChrome(lines);
    expect(result).toEqual(['output']);
  });

  it('preserves content that is not TUI chrome', () => {
    const lines = ['line 1', 'line 2', 'line 3'];
    const result = stripTuiChrome(lines);
    expect(result).toEqual(['line 1', 'line 2', 'line 3']);
  });

  it('handles empty input', () => {
    expect(stripTuiChrome([])).toEqual([]);
  });

  it('does not strip normal content with $ signs', () => {
    const lines = ['the cost is $5', 'echo $HOME'];
    const result = stripTuiChrome(lines);
    expect(result).toEqual(['the cost is $5', 'echo $HOME']);
  });

  it('does not strip markdown table lines', () => {
    const lines = ['│ Name │ Value │', '│ foo  │ bar   │'];
    const result = stripTuiChrome(lines);
    expect(result).toEqual(['│ Name │ Value │', '│ foo  │ bar   │']);
  });

  // Fallback: when there's no prompt box, still strip known chrome from bottom
  it('removes standalone statusbar with ctx info', () => {
    const lines = [
      'Some output text',
      'Opus 4.6 (1M context)   ctx: 100K/1M (10%)   📂 project   ⎇ main*',
    ];
    const result = stripTuiChrome(lines);
    expect(result).toEqual(['Some output text']);
  });

  it('removes standalone mode indicator line', () => {
    const lines = [
      'output',
      '⏵⏵ accept edits on (shift+tab to cycle)',
    ];
    const result = stripTuiChrome(lines);
    expect(result).toEqual(['output']);
  });

  it('removes standalone branch indicator', () => {
    const lines = ['output', '⎇ main*'];
    expect(stripTuiChrome(lines)).toEqual(['output']);
  });

  it('removes standalone project indicator', () => {
    const lines = ['output', '📂 my-project'];
    expect(stripTuiChrome(lines)).toEqual(['output']);
  });
});
