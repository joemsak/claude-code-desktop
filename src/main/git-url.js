const SHORTHAND = /^[a-zA-Z0-9_-][\w.-]*\/[a-zA-Z0-9_][\w.-]*$/;

function parseGitUrl(input) {
  if (typeof input !== "string") return { valid: false };
  const trimmed = input.trim();
  if (!trimmed) return { valid: false };
  if (/\s/.test(trimmed)) return { valid: false };

  let url;
  let pathPart;

  if (trimmed.startsWith("git@")) {
    const m = trimmed.match(/^git@[^\s:]+:(.+)$/);
    if (!m) return { valid: false };
    url = trimmed;
    pathPart = m[1];
  } else if (
    trimmed.startsWith("ssh://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  ) {
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { valid: false };
    }
    url = trimmed;
    pathPart = parsed.pathname.replace(/^\/+/, "");
  } else if (SHORTHAND.test(trimmed)) {
    url = `https://github.com/${trimmed}.git`;
    pathPart = trimmed;
  } else {
    return { valid: false };
  }

  const segments = pathPart.split("/").filter(Boolean);
  if (segments.length === 0) return { valid: false };

  let name = segments[segments.length - 1];
  if (name.endsWith(".git")) name = name.slice(0, -4);

  if (!name || name === "." || name === "..") return { valid: false };
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) {
    return { valid: false };
  }
  if (name.length > 255) return { valid: false };

  return { valid: true, url, name };
}

module.exports = { parseGitUrl };
