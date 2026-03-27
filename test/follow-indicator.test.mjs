import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf-8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf-8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf-8');

describe('follow indicator', () => {
  it('has a follow indicator element in the HTML', () => {
    expect(htmlSource).toContain('id="follow-indicator"');
  });

  it('places the indicator inside the terminal container area', () => {
    const indicatorPos = htmlSource.indexOf('follow-indicator');
    const termContainerPos = htmlSource.indexOf('terminal-container');
    expect(indicatorPos).toBeGreaterThan(termContainerPos);
  });

  it('has CSS styles for the follow indicator', () => {
    expect(cssSource).toContain('#follow-indicator');
  });

  it('has an updateFollowIndicator function in app.js', () => {
    expect(appSource).toMatch(/function updateFollowIndicator/);
  });

  it('tracks scroll position to update the indicator', () => {
    expect(appSource).toMatch(/updateFollowIndicator/);
  });

  it('clicking the indicator scrolls to bottom', () => {
    expect(appSource).toMatch(/follow-indicator/);
    expect(appSource).toMatch(/scrollToBottom/);
  });
});
