const http = require("http");

function createHookServer(onStateChange) {
  const tabStates = new Map();
  let server = null;

  const EVENT_TO_STATE = {
    UserPromptSubmit: "working",
    PreToolUse: "working",
    PostToolUse: "working",
    Stop: "idle",
    Notification: "waiting",
  };

  function handleRequest(req, res) {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
    }

    const match = req.url.match(/^\/hooks\/ccd-(.+)$/);
    if (!match) {
      res.writeHead(404);
      res.end();
      return;
    }

    const tabId = match[1];
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const newState = EVENT_TO_STATE[payload.hook_event_name];
        if (newState) {
          tabStates.set(tabId, newState);
          if (onStateChange) onStateChange(tabId, newState);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
      } catch {
        res.writeHead(400);
        res.end();
      }
    });
  }

  function start() {
    return new Promise((resolve) => {
      server = http.createServer(handleRequest);
      server.listen(0, "127.0.0.1", () => {
        resolve(server.address().port);
      });
    });
  }

  function stop() {
    return new Promise((resolve) => {
      if (!server) return resolve();
      server.close(() => resolve());
    });
  }

  function getState(tabId) {
    return tabStates.get(tabId) || null;
  }

  function removeTab(tabId) {
    tabStates.delete(tabId);
  }

  return { start, stop, getState, removeTab };
}

module.exports = { createHookServer };
