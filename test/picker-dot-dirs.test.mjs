import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "main", "main.js"),
  "utf-8",
);
const appSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "app.js"),
  "utf-8",
);

describe("workspace picker ignores dot directories", () => {
  it("filters out entries whose name starts with a dot", () => {
    // The dirs:list-workspace handler must exclude hidden directories
    // (names starting with ".") from the workspace listing
    const handlerMatch = mainSource.match(
      /ipcMain\.handle\("dirs:list-workspace"[\s\S]*?\n\}\);/,
    );
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch[0];

    // Must filter out names starting with "."
    expect(handler).toMatch(/!e\.name\.startsWith\("\."\)/);
  });
});

describe("home directory picker styling", () => {
  it("applies a distinct CSS class to the home item", () => {
    // The ~ (Home) item should get a picker-home class for distinct styling
    const renderMatch = appSource.match(
      /function renderPickerList\(filter\)\s*\{[\s\S]*?\n\}/,
    );
    expect(renderMatch).not.toBeNull();
    expect(renderMatch[0]).toContain("picker-home");
  });
});
