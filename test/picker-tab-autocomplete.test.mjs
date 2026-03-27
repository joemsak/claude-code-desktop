import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "app.js"),
  "utf-8",
);

describe("picker Tab key autocomplete", () => {
  it("handles Tab key in the picker keydown listener", () => {
    // Tab must be handled to prevent default browser focus behavior
    const keydownBlock = appSource.match(
      /pickerSearch\.addEventListener\("keydown"[\s\S]*?\n\}\);/,
    );
    expect(keydownBlock).not.toBeNull();
    expect(keydownBlock[0]).toContain('"Tab"');
  });

  it("prevents default on Tab to stop focus from moving", () => {
    const keydownBlock = appSource.match(
      /pickerSearch\.addEventListener\("keydown"[\s\S]*?\n\}\);/,
    );
    // Find the Tab handling section
    const tabSection = keydownBlock[0].match(
      /e\.key\s*===\s*"Tab"[\s\S]*?(?=\}\s*else|\}\s*\n\})/,
    );
    expect(tabSection).not.toBeNull();
    expect(tabSection[0]).toContain("preventDefault");
  });

  it("fills the search input with the selected item name on Tab", () => {
    const keydownBlock = appSource.match(
      /pickerSearch\.addEventListener\("keydown"[\s\S]*?\n\}\);/,
    );
    const tabSection = keydownBlock[0].match(
      /e\.key\s*===\s*"Tab"[\s\S]*?(?=\}\s*else|\}\s*\n\})/,
    );
    expect(tabSection).not.toBeNull();
    // Should set the search input value to the selected item's name
    expect(tabSection[0]).toContain("pickerSearch.value");
    expect(tabSection[0]).toContain(".name");
  });

  it("re-renders the picker list after Tab autocomplete", () => {
    const keydownBlock = appSource.match(
      /pickerSearch\.addEventListener\("keydown"[\s\S]*?\n\}\);/,
    );
    const tabSection = keydownBlock[0].match(
      /e\.key\s*===\s*"Tab"[\s\S]*?(?=\}\s*else|\}\s*\n\})/,
    );
    expect(tabSection).not.toBeNull();
    expect(tabSection[0]).toContain("renderPickerList");
  });
});
