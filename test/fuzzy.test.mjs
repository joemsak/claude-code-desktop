import { describe, it, expect } from "vitest";
import { fuzzyMatch, fuzzyScore } from "../src/renderer/fuzzy.js";

describe("fuzzyMatch", () => {
  it("matches exact substring", () => {
    expect(fuzzyMatch("claude-code-desktop", "claude")).toBe(true);
  });

  it("matches non-contiguous characters in order", () => {
    expect(fuzzyMatch("claude-code-desktop", "claco")).toBe(true);
  });

  it("matches scattered characters", () => {
    expect(fuzzyMatch("claude-code-desktop", "cdt")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(fuzzyMatch("Claude-Code-Desktop", "CCD")).toBe(true);
    expect(fuzzyMatch("claude-code-desktop", "CCD")).toBe(true);
  });

  it("rejects when characters are not all present", () => {
    expect(fuzzyMatch("claude-code-desktop", "xyz")).toBe(false);
  });

  it("rejects when characters are present but in wrong order", () => {
    expect(fuzzyMatch("claude-code-desktop", "odalc")).toBe(false);
  });

  it("matches empty pattern", () => {
    expect(fuzzyMatch("anything", "")).toBe(true);
  });

  it("rejects empty text with non-empty pattern", () => {
    expect(fuzzyMatch("", "a")).toBe(false);
  });
});

describe("fuzzyScore", () => {
  it("returns -1 for non-matching pattern", () => {
    expect(fuzzyScore("claude-code-desktop", "xyz")).toBe(-1);
  });

  it("scores consecutive matches higher than scattered", () => {
    const consecutive = fuzzyScore("claude-code-desktop", "claude");
    const scattered = fuzzyScore("claude-code-desktop", "claco");
    expect(consecutive).toBeGreaterThan(scattered);
  });

  it("gives bonus for matches after separators", () => {
    // "cd" matches c(laude)-d(esktop) hitting both word starts
    const atBoundary = fuzzyScore("claude-desktop", "cd");
    // "la" matches c(l)aude-desktop, no boundary bonus
    const midWord = fuzzyScore("claude-desktop", "la");
    expect(atBoundary).toBeGreaterThan(midWord);
  });

  it("prefers shorter names (closer match)", () => {
    const short = fuzzyScore("code", "code");
    const long = fuzzyScore("code-very-long-name", "code");
    expect(short).toBeGreaterThan(long);
  });

  it("ranks exact prefix highest", () => {
    const exact = fuzzyScore("claude", "claude");
    const partial = fuzzyScore("claude-code-desktop", "claude");
    expect(exact).toBeGreaterThan(partial);
  });
});
