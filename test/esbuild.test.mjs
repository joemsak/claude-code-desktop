import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

describe('esbuild bundle', () => {
  it('bundles renderer without errors', () => {
    execSync('node esbuild.config.js', { cwd: projectRoot, stdio: 'pipe' });
    const bundlePath = path.join(projectRoot, 'src', 'renderer', 'bundle.js');
    expect(fs.existsSync(bundlePath)).toBe(true);
    const content = fs.readFileSync(bundlePath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('Terminal');
  });

  it('produces a sourcemap', () => {
    const mapPath = path.join(projectRoot, 'src', 'renderer', 'bundle.js.map');
    expect(fs.existsSync(mapPath)).toBe(true);
  });
});
