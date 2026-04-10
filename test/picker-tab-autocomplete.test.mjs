import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pickerSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "picker.js"),
  "utf-8",
);

describe("picker Tab key autocomplete", () => {
  it("handles Tab key in the picker keydown listener", () => {
    // Tab must be handled to prevent default browser focus behavior
    const keydownBlock = pickerSource.match(
      /search\.addEventListener\("keydown"[\s\S]*?\n {2}\}\);/,
    );
    expect(keydownBlock).not.toBeNull();
    expect(keydownBlock[0]).toContain('"Tab"');
  });

  it("prevents default on Tab to stop focus from moving", () => {
    const keydownBlock = pickerSource.match(
      /search\.addEventListener\("keydown"[\s\S]*?\n {2}\}\);/,
    );
    const tabSection = keydownBlock[0].match(
      /e\.key\s*===\s*"Tab"[\s\S]*?(?=\}\s*else|\}\s*\n\s*\})/,
    );
    expect(tabSection).not.toBeNull();
    expect(tabSection[0]).toContain("preventDefault");
  });

  it("fills the search input with the selected item name on Tab", () => {
    const keydownBlock = pickerSource.match(
      /search\.addEventListener\("keydown"[\s\S]*?\n {2}\}\);/,
    );
    const tabSection = keydownBlock[0].match(
      /e\.key\s*===\s*"Tab"[\s\S]*?(?=\}\s*else|\}\s*\n\s*\})/,
    );
    expect(tabSection).not.toBeNull();
    expect(tabSection[0]).toContain("search.value");
    expect(tabSection[0]).toContain(".name");
  });

  it("re-renders the picker list after Tab autocomplete", () => {
    const keydownBlock = pickerSource.match(
      /search\.addEventListener\("keydown"[\s\S]*?\n {2}\}\);/,
    );
    const tabSection = keydownBlock[0].match(
      /e\.key\s*===\s*"Tab"[\s\S]*?(?=\}\s*else|\}\s*\n\s*\})/,
    );
    expect(tabSection).not.toBeNull();
    expect(tabSection[0]).toContain("renderList");
  });
});
