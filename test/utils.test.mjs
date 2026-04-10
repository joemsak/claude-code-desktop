import { describe, it, expect } from "vitest";
import { basename, getDisplayName, filterED3, isEffectiveDangerous } from "../src/renderer/utils.js";

describe("basename", () => {
  it("extracts the last path segment", () => {
    expect(basename("/Users/joe/workspace/my-project")).toBe("my-project");
  });

  it("handles single segment", () => {
    expect(basename("mydir")).toBe("mydir");
  });

  it("handles trailing slash by returning full path", () => {
    expect(basename("/foo/bar/")).toBe("/foo/bar/");
  });

  it("returns original string if no slashes", () => {
    expect(basename("hello")).toBe("hello");
  });
});

describe("getDisplayName", () => {
  it("returns customName when set", () => {
    const tab = { customName: "My Tab", directory: "/foo/bar" };
    expect(getDisplayName(tab, [])).toBe("My Tab");
  });

  it("returns basename when no duplicates", () => {
    const tab = { customName: null, directory: "/foo/bar" };
    expect(getDisplayName(tab, [tab])).toBe("bar");
  });

  it("appends index for duplicate basenames", () => {
    const tab1 = { customName: null, directory: "/a/project" };
    const tab2 = { customName: null, directory: "/b/project" };
    const allTabs = [tab1, tab2];
    expect(getDisplayName(tab1, allTabs)).toBe("project");
    expect(getDisplayName(tab2, allTabs)).toBe("project (2)");
  });

  it("ignores tabs with customName when checking duplicates", () => {
    const tab1 = { customName: "Custom", directory: "/a/project" };
    const tab2 = { customName: null, directory: "/b/project" };
    const allTabs = [tab1, tab2];
    expect(getDisplayName(tab2, allTabs)).toBe("project");
  });
});

describe("filterED3", () => {
  it("strips ED3 when paired with ED2", () => {
    const input = "\x1b[2J\x1b[3J";
    expect(filterED3(input)).toBe("\x1b[2J");
  });

  it("preserves standalone ED3", () => {
    const input = "\x1b[3J";
    expect(filterED3(input)).toBe("\x1b[3J");
  });

  it("handles multiple ED2+ED3 pairs", () => {
    const input = "hello\x1b[2J\x1b[3Jworld\x1b[2J\x1b[3J";
    expect(filterED3(input)).toBe("hello\x1b[2Jworld\x1b[2J");
  });

  it("passes through normal text unchanged", () => {
    expect(filterED3("hello world")).toBe("hello world");
  });
});

describe("isEffectiveDangerous", () => {
  it("returns false when both are false (XOR)", () => {
    expect(isEffectiveDangerous(false, false)).toBe(false);
  });

  it("returns true when shift held but not default", () => {
    expect(isEffectiveDangerous(true, false)).toBe(true);
  });

  it("returns true when default but shift not held", () => {
    expect(isEffectiveDangerous(false, true)).toBe(true);
  });

  it("returns false when both true (XOR cancels)", () => {
    expect(isEffectiveDangerous(true, true)).toBe(false);
  });
});
