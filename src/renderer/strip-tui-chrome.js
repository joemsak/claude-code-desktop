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

  // Strategy 1: Find the prompt box (border → prompt → border) and truncate from there.
  // This catches the entire prompt area + everything below it (statusbar, PR info, etc.)
  // regardless of what specific lines appear after the prompt box.
  for (let i = result.length - 1; i >= 2; i--) {
    if (BORDER_RE.test(result[i].trim())) {
      // Look backwards for prompt line, then another border
      for (let j = i - 1; j >= 1; j--) {
        const trimmed = result[j].trim();
        if (trimmed === "") continue; // skip blanks between border and prompt
        if (PROMPT_RE.test(trimmed)) {
          // Found prompt, now look for the top border
          for (let k = j - 1; k >= 0; k--) {
            const kTrimmed = result[k].trim();
            if (kTrimmed === "") continue; // skip blanks
            if (BORDER_RE.test(kTrimmed)) {
              // Found the full prompt box pattern — truncate from top border
              result.length = k;
              // Strip trailing empty lines
              while (
                result.length > 0 &&
                result[result.length - 1].trim() === ""
              ) {
                result.pop();
              }
              return result;
            }
            break; // non-empty, non-border line — not a prompt box
          }
        }
        break; // non-empty, non-prompt line — not a prompt box
      }
    }
  }

  // Strategy 2 (fallback): Strip known chrome lines from the bottom.
  // Handles cases where terminal only shows statusbar without a prompt box.
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
