const path = require("path");
const { parseGitUrl } = require("./git-url");

function createGitParseUrlHandler() {
  return (_event, url) => {
    const parsed = parseGitUrl(url);
    if (!parsed.valid) return { valid: false };
    return { valid: true, url: parsed.url, name: parsed.name };
  };
}

function createGitCloneHandler({ ptyManager, getWorkspaceDir }) {
  return (event, payload) => {
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "Invalid payload" };
    }
    const { tabId, url, dangerousMode } = payload;
    if (typeof tabId !== "string" || !tabId) {
      return { ok: false, error: "Invalid tabId" };
    }
    const parsed = parseGitUrl(url);
    if (!parsed.valid) {
      return { ok: false, error: "Not a valid git URL" };
    }
    const workspaceDir = getWorkspaceDir();
    ptyManager.spawn(
      tabId,
      workspaceDir,
      (id, data) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send("pty:data", id, data);
        }
      },
      (id, exitCode) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send("pty:exit", id, exitCode);
        }
      },
      {
        dangerousMode: !!dangerousMode,
        command: {
          type: "git-clone",
          url: parsed.url,
          name: parsed.name,
        },
      },
    );
    return {
      ok: true,
      name: parsed.name,
      path: path.join(workspaceDir, parsed.name),
    };
  };
}

module.exports = { createGitParseUrlHandler, createGitCloneHandler };
