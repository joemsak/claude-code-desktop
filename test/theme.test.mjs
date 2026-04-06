import { describe, it, expect } from "vitest";
import { getThemeByName } from "../src/renderer/themes.js";

describe("theme (legacy compatibility)", () => {
  it("Catppuccin Mocha terminal theme has correct background", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    expect(theme.terminal.background).toBe("#1e1e2e");
  });

  it("Catppuccin Mocha terminal theme has correct foreground", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    expect(theme.terminal.foreground).toBe("#cdd6f4");
  });

  it("Catppuccin Mocha terminal theme has cursor color", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    expect(theme.terminal.cursor).toBe("#f5e0dc");
  });

  it("Catppuccin Mocha terminal theme has selection color", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    expect(theme.terminal.selectionBackground).toBe("#45475a");
  });

  it("has all 8 ANSI colors as valid hex", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
    for (const color of colors) {
      expect(theme.terminal[color]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has all 8 bright ANSI colors as valid hex", () => {
    const theme = getThemeByName("Catppuccin Mocha");
    const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
    for (const color of colors) {
      const bright = "bright" + color.charAt(0).toUpperCase() + color.slice(1);
      expect(theme.terminal[bright]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
