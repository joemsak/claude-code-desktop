const pty = require("node-pty");
const os = require("os");

function createManager(ptyModule) {
  const ptyLib = ptyModule || pty;
  const ptys = new Map();

  function spawn(tabId, directory, onData, onExit) {
    const shell = process.env.SHELL || "/bin/zsh";
    const ptyProcess = ptyLib.spawn(shell, ["-l", "-c", "claude"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: directory,
      env: { ...process.env, HOME: os.homedir() },
    });

    ptyProcess.onData((data) => onData(tabId, data));
    ptyProcess.onExit(({ exitCode }) => {
      ptys.delete(tabId);
      onExit(tabId, exitCode);
    });

    ptys.set(tabId, { process: ptyProcess, directory });
    return ptyProcess;
  }

  function write(tabId, data) {
    const entry = ptys.get(tabId);
    if (entry) entry.process.write(data);
  }

  function resize(tabId, cols, rows) {
    const entry = ptys.get(tabId);
    if (entry) entry.process.resize(cols, rows);
  }

  function kill(tabId) {
    const entry = ptys.get(tabId);
    if (entry) {
      entry.process.kill();
      ptys.delete(tabId);
    }
  }

  function killAll() {
    for (const [, entry] of ptys) {
      entry.process.kill();
    }
    ptys.clear();
  }

  return { spawn, write, resize, kill, killAll };
}

// Default instance for production use
const defaultManager = createManager();

module.exports = { ...defaultManager, createManager };
