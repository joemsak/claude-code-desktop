const pty = require("node-pty");
const os = require("os");
const { execSync } = require("child_process");

function createManager(ptyModule, execModule) {
  const ptyLib = ptyModule || pty;
  const execFn = execModule || execSync;
  const ptys = new Map();

  function ensureAwsAuth(env) {
    const profile = env.AWS_PROFILE || "bedrock-users";
    try {
      execFn(`aws sts get-caller-identity --profile ${profile}`, {
        stdio: "ignore",
        env,
        timeout: 10000,
      });
    } catch {
      try {
        execFn(`aws sso login --profile ${profile}`, {
          stdio: "ignore",
          env,
          timeout: 30000,
        });
      } catch {
        // Best effort — claude will show its own auth prompt if needed
      }
    }
  }

  function spawn(tabId, directory, onData, onExit) {
    const shell = process.env.SHELL || "/bin/zsh";
    const cleanEnv = Object.fromEntries(
      Object.entries({ ...process.env, HOME: os.homedir() }).filter(
        ([k]) => !k.startsWith("npm_config_") && !k.startsWith("npm_"),
      ),
    );

    ensureAwsAuth(cleanEnv);

    // Source .zshrc for PATH (mise, nvm, etc.) but non-interactive to avoid
    // shell init output. Then exec claude to replace the shell.
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

  return { spawn, write, resize, kill, killAll, getCwd };
}

// Default instance for production use
const defaultManager = createManager();

module.exports = { ...defaultManager, createManager };
