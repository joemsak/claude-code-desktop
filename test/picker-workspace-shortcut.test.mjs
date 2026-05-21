import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "main", "main.js"),
  "utf-8",
);
const preloadSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "preload", "preload.js"),
  "utf-8",
);
const pickerSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "picker.js"),
  "utf-8",
);

describe("util:home-path uses process.env.HOME", () => {
  it("prefers process.env.HOME over os.homedir()", () => {
    const handlerMatch = mainSource.match(
      /ipcMain\.handle\("util:home-path"[\s\S]*?\)\s*\);/,
    );
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch[0]).toMatch(/process\.env\.HOME/);
  });
});

describe("util:workspace-path IPC handler", () => {
  it("registers a util:workspace-path handler in main", () => {
    expect(mainSource).toContain('"util:workspace-path"');
  });

  it("returns null when the workspace directory does not exist", () => {
    const handlerMatch = mainSource.match(
      /ipcMain\.handle\("util:workspace-path"[\s\S]*?\)\s*\);/,
    );
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch[0]).toMatch(/null/);
    expect(handlerMatch[0]).toMatch(/existsSync|exists/);
  });
});

describe("preload exposes getWorkspacePath", () => {
  it("exposes getWorkspacePath via electronAPI", () => {
    expect(preloadSource).toContain("getWorkspacePath");
    expect(preloadSource).toContain('"util:workspace-path"');
  });
});

describe("picker workspace shortcut", () => {
  it("calls getWorkspacePath during refresh", () => {
    expect(pickerSource).toContain("getWorkspacePath");
  });

  it("adds a workspace item after the home item when path is present", () => {
    const refreshMatch = pickerSource.match(
      /async function refreshPickerDirs[\s\S]*?\n {2}\}/,
    );
    expect(refreshMatch).not.toBeNull();
    const fn = refreshMatch[0];
    // workspace item must appear and be positioned after home item in pickerDirs
    const homeIdx = fn.indexOf("isHome");
    const workspaceIdx = fn.indexOf("isWorkspace");
    expect(workspaceIdx).toBeGreaterThan(-1);
    expect(workspaceIdx).toBeGreaterThan(homeIdx);
  });

  it("marks workspace item as isWorkspace so it cannot be deleted", () => {
    // canDeleteDir must exclude isWorkspace items
    const canDeleteMatch = pickerSource.match(
      /function canDeleteDir[\s\S]*?\n {2}\}/,
    );
    expect(canDeleteMatch).not.toBeNull();
    expect(canDeleteMatch[0]).toMatch(/isWorkspace/);
  });

  it("renders workspace item with picker-home CSS class (same style as home)", () => {
    const renderMatch = pickerSource.match(
      /function renderList[\s\S]*?\n {2}\}/,
    );
    expect(renderMatch).not.toBeNull();
    expect(renderMatch[0]).toMatch(/isWorkspace[\s\S]{0,60}picker-home|picker-home[\s\S]{0,200}isWorkspace/);
  });

  it("does not show a path subtitle for the workspace item", () => {
    // Path subtitle is skipped for isHome items; same must apply to isWorkspace
    const renderMatch = pickerSource.match(
      /function renderList[\s\S]*?\n {2}\}/,
    );
    expect(renderMatch).not.toBeNull();
    // The path-subtitle guard must exclude isWorkspace
    expect(renderMatch[0]).toMatch(/isWorkspace/);
  });
});

describe("home item label uses directory basename", () => {
  it("uses basename(homePath) as the home item name rather than a hardcoded string", () => {
    const refreshMatch = pickerSource.match(
      /async function refreshPickerDirs[\s\S]*?\n {2}\}/,
    );
    expect(refreshMatch).not.toBeNull();
    const fn = refreshMatch[0];
    // Must not use the old hardcoded label
    expect(fn).not.toContain('"~ (Home)"');
    // Must derive the name from the path using basename
    expect(fn).toMatch(/basename\s*\(\s*homePath\s*\)/);
  });
});
