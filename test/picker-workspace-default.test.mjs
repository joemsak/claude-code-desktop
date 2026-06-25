import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pickerSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "picker.js"),
  "utf-8",
);
const mainSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "main", "main.js"),
  "utf-8",
);

describe("picker open() pre-selects workspace", () => {
  it("finds the workspace item index from selectable dirs on open", () => {
    const openMatch = pickerSource.match(
      /async function open[\s\S]*?\n {2}\}/,
    );
    expect(openMatch).not.toBeNull();
    expect(openMatch[0]).toMatch(/isWorkspace/);
  });

  it("sets pickerSelectedIndex to workspace item index, not always 0", () => {
    const openMatch = pickerSource.match(
      /async function open[\s\S]*?\n {2}\}/,
    );
    expect(openMatch).not.toBeNull();
    const fn = openMatch[0];
    // Must not unconditionally set pickerSelectedIndex = 0
    expect(fn).not.toMatch(/pickerSelectedIndex\s*=\s*0\s*;/);
  });

  it("falls back to index 0 when no workspace item exists", () => {
    const openMatch = pickerSource.match(
      /async function open[\s\S]*?\n {2}\}/,
    );
    expect(openMatch).not.toBeNull();
    expect(openMatch[0]).toMatch(/workspaceIdx.*>=.*0.*\?|workspaceIdx.*>.*-1.*\?/);
  });
});

describe("Cmd+N opens new tab (before-input-event)", () => {
  it("handles key 'n' with meta in the before-input-event handler", () => {
    const handlerMatch = mainSource.match(
      /before-input-event[\s\S]*?input\.key\s*===\s*["']n["']/,
    );
    expect(handlerMatch).not.toBeNull();
  });

  it("sends menu:new-tab on Cmd+N input event", () => {
    const handlerMatch = mainSource.match(
      /before-input-event[\s\S]*?menu:new-tab/,
    );
    expect(handlerMatch).not.toBeNull();
  });
});
