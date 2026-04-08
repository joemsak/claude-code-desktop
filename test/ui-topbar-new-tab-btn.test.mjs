import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('topbar new tab button centering', () => {
  it('uses flex centering for the icon', () => {
    const btnBlock = cssSource.match(/#topbar-new-tab\s*\{[^}]*\}/);
    expect(btnBlock).not.toBeNull();
    expect(btnBlock[0]).toContain('display: flex');
    expect(btnBlock[0]).toContain('align-items: center');
    expect(btnBlock[0]).toContain('justify-content: center');
  });

  it('uses fixed dimensions for symmetric hover background', () => {
    const btnBlock = cssSource.match(/#topbar-new-tab\s*\{[^}]*\}/);
    expect(btnBlock).not.toBeNull();
    expect(btnBlock[0]).toContain('width:');
    expect(btnBlock[0]).toContain('height:');
  });
});
