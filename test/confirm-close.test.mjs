import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "app.js"),
  "utf-8",
);
const mainSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "main", "main.js"),
  "utf-8",
);
const preloadSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "preload", "preload.js"),
  "utf-8",
);

describe("tab close confirmation", () => {
  it("closeTab checks tab.exited before destroying", () => {
    const closeTabBlock = appSource.match(
      /async function closeTab\([\s\S]*?\n\}/,
    );
    expect(closeTabBlock).not.toBeNull();
    const code = closeTabBlock[0];

    // Should check if tab is exited and show confirmation for live tabs
    expect(code).toContain("exited");
  });

  it("closeTab calls confirmClose for live tabs", () => {
    const closeTabBlock = appSource.match(
      /async function closeTab\([\s\S]*?\n\}/,
    );
    expect(closeTabBlock).not.toBeNull();
    const code = closeTabBlock[0];

    // Should call the IPC confirmation dialog for non-exited tabs
    expect(code).toContain("confirmClose");
  });

  it("preload exposes confirmClose IPC channel", () => {
    expect(preloadSource).toContain("confirmClose");
    expect(preloadSource).toContain("dialog:confirm-close");
  });

  it("main process handles dialog:confirm-close IPC", () => {
    expect(mainSource).toContain("dialog:confirm-close");
    expect(mainSource).toContain("showMessageBox");
  });
});

describe("quit confirmation", () => {
  it("intercepts window close to check for active sessions", () => {
    // The close handler should check for active tabs before allowing close
    const closeHandler = mainSource.match(
      /mainWindow\.on\("close"[\s\S]*?\}\)/,
    );
    expect(closeHandler).not.toBeNull();
    const code = closeHandler[0];

    expect(code).toContain("preventDefault");
  });

  it("shows confirmation dialog when active tabs exist on quit", () => {
    const closeHandler = mainSource.match(
      /mainWindow\.on\("close"[\s\S]*?\}\)/,
    );
    expect(closeHandler).not.toBeNull();
    const code = closeHandler[0];

    expect(code).toContain("showMessageBox");
  });

  it("checks pty manager for active sessions", () => {
    const closeHandler = mainSource.match(
      /mainWindow\.on\("close"[\s\S]*?\}\)/,
    );
    expect(closeHandler).not.toBeNull();
    const code = closeHandler[0];

    // Should query pty manager to check for active processes
    expect(code).toContain("hasActive");
  });
});
