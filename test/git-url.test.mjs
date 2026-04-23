import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parseGitUrl } = require('../src/main/git-url');

describe('parseGitUrl', () => {
  describe('accepted shapes', () => {
    it('accepts SSH form with .git', () => {
      const r = parseGitUrl('git@github.com:joemsak/claude-code-desktop.git');
      expect(r.valid).toBe(true);
      expect(r.name).toBe('claude-code-desktop');
      expect(r.url).toBe('git@github.com:joemsak/claude-code-desktop.git');
    });

    it('accepts SSH form without .git', () => {
      const r = parseGitUrl('git@github.com:joemsak/foo');
      expect(r.valid).toBe(true);
      expect(r.name).toBe('foo');
    });

    it('accepts HTTPS form with .git', () => {
      const r = parseGitUrl('https://github.com/joemsak/claude-code-desktop.git');
      expect(r.valid).toBe(true);
      expect(r.name).toBe('claude-code-desktop');
    });

    it('accepts HTTPS form without .git', () => {
      const r = parseGitUrl('https://github.com/joemsak/claude-code-desktop');
      expect(r.valid).toBe(true);
      expect(r.name).toBe('claude-code-desktop');
    });

    it('accepts http:// form', () => {
      const r = parseGitUrl('http://git.example.com/foo/bar.git');
      expect(r.valid).toBe(true);
      expect(r.name).toBe('bar');
    });

    it('accepts ssh:// form', () => {
      const r = parseGitUrl('ssh://git@github.com/joemsak/foo.git');
      expect(r.valid).toBe(true);
      expect(r.name).toBe('foo');
    });

    it('expands bare owner/repo shorthand to GitHub HTTPS', () => {
      const r = parseGitUrl('joemsak/claude-code-desktop');
      expect(r.valid).toBe(true);
      expect(r.name).toBe('claude-code-desktop');
      expect(r.url).toBe('https://github.com/joemsak/claude-code-desktop.git');
    });

    it('trims surrounding whitespace', () => {
      const r = parseGitUrl('  git@github.com:joemsak/foo.git  ');
      expect(r.valid).toBe(true);
      expect(r.name).toBe('foo');
    });

    it('handles nested paths in HTTPS (e.g. GitLab subgroups)', () => {
      const r = parseGitUrl('https://gitlab.com/group/subgroup/project.git');
      expect(r.valid).toBe(true);
      expect(r.name).toBe('project');
    });
  });

  describe('rejected inputs', () => {
    it('rejects empty string', () => {
      expect(parseGitUrl('').valid).toBe(false);
    });

    it('rejects whitespace-only', () => {
      expect(parseGitUrl('   ').valid).toBe(false);
    });

    it('rejects file:// URLs', () => {
      expect(parseGitUrl('file:///etc/passwd').valid).toBe(false);
    });

    it('rejects javascript: URLs', () => {
      expect(parseGitUrl('javascript:alert(1)').valid).toBe(false);
    });

    it('rejects data: URLs', () => {
      expect(parseGitUrl('data:text/plain,hello').valid).toBe(false);
    });

    it('rejects URLs with embedded spaces', () => {
      expect(parseGitUrl('git@github.com:joe msak/foo.git').valid).toBe(false);
    });

    it('rejects URLs whose derived name would contain path traversal', () => {
      // Contrived: if someone crafts a URL whose last segment is ".."
      expect(parseGitUrl('https://github.com/foo/..').valid).toBe(false);
    });

    it('rejects free text (no / anywhere)', () => {
      expect(parseGitUrl('just-a-repo-name').valid).toBe(false);
    });

    it('rejects shorthand with extra path segments', () => {
      expect(parseGitUrl('owner/repo/extra').valid).toBe(false);
    });

    it('rejects shorthand that looks like a path', () => {
      expect(parseGitUrl('./relative/path').valid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('non-string input returns invalid', () => {
      expect(parseGitUrl(null).valid).toBe(false);
      expect(parseGitUrl(undefined).valid).toBe(false);
      expect(parseGitUrl(42).valid).toBe(false);
    });
  });
});
