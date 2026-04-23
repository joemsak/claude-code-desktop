const os = require("os");
const path = require("path");

function isSafePath(input, homedir) {
  if (typeof input !== "string" || !input) return false;
  if (!path.isAbsolute(input)) return false;
  const normalized = path.normalize(input);
  if (normalized === "/" || normalized === "") return false;
  if (normalized === homedir) return false;
  if (normalized.length < 4) return false;
  return true;
}

function createTrashWorkspaceHandler({
  trashItem,
  removeRecentWorkspace,
  homedir = () => os.homedir(),
}) {
  return async (_event, dirPath) => {
    const home = homedir();
    if (!isSafePath(dirPath, home)) {
      return { ok: false, error: "Refused: unsafe path" };
    }
    try {
      await trashItem(dirPath);
    } catch (err) {
      return {
        ok: false,
        error: err && err.message ? err.message : "Trash failed",
      };
    }
    try {
      removeRecentWorkspace(dirPath);
    } catch {
      /* best-effort */
    }
    return { ok: true };
  };
}

function createRemoveRecentWorkspaceHandler({ removeRecentWorkspace }) {
  return (_event, dirPath) => {
    if (typeof dirPath !== "string" || !dirPath) {
      return { ok: false, error: "Invalid path" };
    }
    removeRecentWorkspace(dirPath);
    return { ok: true };
  };
}

module.exports = {
  isSafePath,
  createTrashWorkspaceHandler,
  createRemoveRecentWorkspaceHandler,
};
