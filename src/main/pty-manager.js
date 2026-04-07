const pty = require("node-pty");
const os = require("os");
const { execSync } = require("child_process");
const { ensureAuth: defaultEnsureAuth } = require("./aws-auth");

function createManager(ptyModule, execModule, preSpawnHook) {
  const ptyLib = ptyModule || pty;
  const execFn = execModule || execSync;
  const onPreSpawn = preSpawnHook || defaultEnsureAuth;
  const ptys = new Map();

  function spawn(tabId, directory, onData, onExit) {
    const shell = process.env.SHELL || "/bin/zsh";
    const cleanEnv = Object.fromEntries(
      Object.entries({ ...process.env, HOME: os.homedir() }).filter(
        ([k]) => !k.startsWith("npm_config_") && !k.startsWith("npm_"),
      ),
    );

    cleanEnv.COLORTERM = "truecolor";

    onPreSpawn(cleanEnv);

    const cmd = "source ~/.zshrc 2>/dev/null; exec claude";
    const ptyProcess = ptyLib.spawn(shell, ["-l", "-c", cmd], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: directory,
      env: cleanEnv,
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

  function getCwd(tabId) {
    const entry = ptys.get(tabId);
    if (!entry) return null;
    const pid = entry.process.pid;
    if (typeof pid !== "number" || pid < 1) return null;
    try {
      const output = execFn(
        `/usr/sbin/lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`,
        { encoding: "utf-8", timeout: 2000 },
      );
      const match = output.match(/^n(.+)$/m);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  function hasActive() {
    return ptys.size > 0;
  }

  return { spawn, write, resize, kill, killAll, getCwd, hasActive };
}

const defaultManager = createManager();

module.exports = { ...defaultManager, createManager };
