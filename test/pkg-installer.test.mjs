import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
const releaseYml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'release.yml'), 'utf-8');

describe('PKG installer distribution', () => {
  it('builds pkg instead of dmg', () => {
    expect(pkg.build.mac.target).toContain('pkg');
    expect(pkg.build.mac.target).not.toContain('dmg');
  });

  it('release workflow uploads pkg artifacts', () => {
    expect(releaseYml).toContain('*.pkg');
    expect(releaseYml).not.toContain('*.dmg');
  });
});
