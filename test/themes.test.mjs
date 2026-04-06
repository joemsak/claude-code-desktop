// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { builtinThemes, getThemeByName, DEFAULT_THEME_NAME, applyTheme } from "../src/renderer/themes.js";

const REQUIRED_CHROME_KEYS = [
  "base", "mantle", "crust", "text", "subtext0", "subtext1",
  "surface0", "surface1", "accent", "warning", "error",
];

const REQUIRED_TERMINAL_KEYS = [
  "background", "foreground", "cursor", "cursorAccent",
  "selectionBackground", "selectionForeground",
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow",
  "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
];

describe("themes", () => {
  it("exports an array of 5 built-in themes", () => {
    expect(builtinThemes).toHaveLength(5);
  });

  it("each theme has a name, chrome, and terminal section", () => {
    for (const theme of builtinThemes) {
      expect(typeof theme.name).toBe("string");
      expect(theme.chrome).toBeDefined();
      expect(theme.terminal).toBeDefined();
    }
  });

  it("each theme has all required chrome keys as valid hex colors", () => {
    for (const theme of builtinThemes) {
      for (const key of REQUIRED_CHROME_KEYS) {
        expect(theme.chrome[key], `${theme.name} chrome.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("each theme has all required terminal keys as valid hex colors", () => {
    for (const theme of builtinThemes) {
      for (const key of REQUIRED_TERMINAL_KEYS) {
        expect(theme.terminal[key], `${theme.name} terminal.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("default theme name is Catppuccin Mocha", () => {
    expect(DEFAULT_THEME_NAME).toBe("Catppuccin Mocha");
  });

  it("getThemeByName returns the correct theme", () => {
    const theme = getThemeByName("Dracula");
    expect(theme).toBeDefined();
    expect(theme.name).toBe("Dracula");
  });

  it("getThemeByName returns Catppuccin Mocha for unknown name", () => {
    const theme = getThemeByName("nonexistent");
    expect(theme.name).toBe("Catppuccin Mocha");
  });

  it("includes Catppuccin Mocha, Dracula, Nord, Tokyo Night, Solarized Dark", () => {
    const names = builtinThemes.map((t) => t.name);
    expect(names).toContain("Catppuccin Mocha");
    expect(names).toContain("Dracula");
    expect(names).toContain("Nord");
    expect(names).toContain("Tokyo Night");
    expect(names).toContain("Solarized Dark");
  });
});

describe("applyTheme", () => {
  it("sets CSS custom properties on the given element", () => {
    const el = document.createElement("div");
    const theme = getThemeByName("Catppuccin Mocha");
    applyTheme(theme, el);
    expect(el.style.getPropertyValue("--base")).toBe("#1e1e2e");
    expect(el.style.getPropertyValue("--text")).toBe("#cdd6f4");
    expect(el.style.getPropertyValue("--accent")).toBe("#89b4fa");
  });

  it("sets all chrome keys as CSS custom properties", () => {
    const el = document.createElement("div");
    const theme = getThemeByName("Dracula");
    applyTheme(theme, el);
    for (const key of REQUIRED_CHROME_KEYS) {
      expect(el.style.getPropertyValue(`--${key}`), `--${key}`).toBe(theme.chrome[key]);
    }
  });
});
