// Strips Claude Code TUI chrome (prompt box + statusbar) from terminal buffer lines.
// Used by hover-peek to show only meaningful output.

// Horizontal rule border: line of ─ characters (prompt top/bottom)
const BORDER_RE = /^─+$/;

// Prompt input line: starts with > or ❯ (no side borders in Claude Code)
const PROMPT_RE = /^\s*(>|❯)\s*$/;

// Statusbar: model info + context usage + project/branch indicators
// e.g. "Opus 4.6 (1M context)   ctx: 100K/1M (10%)   📂 project   ⎇ main*"
const STATUSBAR_RE = /\bctx:\s*\d+[KMG]?\/\d+[KMG]?\b|⎇\s|📂\s/;

// Mode indicator line: permission mode hints
// e.g. "⏵⏵ accept edits on (shift+tab to cycle)"
const MODE_RE = /^⏵|shift\+tab to cycle/;

export function stripTuiChrome(lines) {
  const result = [...lines];

  // Strip from the bottom
  while (result.length > 0) {
    const last = result[result.length - 1].trim();
    if (
      last === "" ||
      BORDER_RE.test(last) ||
      PROMPT_RE.test(last) ||
      STATUSBAR_RE.test(last) ||
      MODE_RE.test(last)
    ) {
      result.pop();
    } else {
      break;
    }
  }

  return result;
}
