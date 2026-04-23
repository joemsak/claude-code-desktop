export function createCloneOrchestrator({
  electronAPI,
  createCloningTab,
  respawnInDir,
  renderRetryBanner,
  clearRetryBanner,
  closeTab,
  openExistingDir,
}) {
  const cloningTabs = new Map();

  async function clone(url, { dangerousMode = false } = {}) {
    const tabId = crypto.randomUUID();
    const result = await electronAPI.cloneRepo({ tabId, url, dangerousMode });
    if (!result || !result.ok) return undefined;
    if (result.alreadyExists) {
      if (openExistingDir) openExistingDir(result.path, { dangerousMode });
      return undefined;
    }
    cloningTabs.set(tabId, {
      url,
      dangerousMode,
      name: result.name,
      path: result.path,
    });
    createCloningTab(tabId, result.name);
    return tabId;
  }

  function handlePtyExit(tabId, exitCode) {
    const entry = cloningTabs.get(tabId);
    if (!entry) return false;
    if (exitCode === 0) {
      cloningTabs.delete(tabId);
      respawnInDir(tabId, entry.path, { dangerousMode: entry.dangerousMode });
      electronAPI.trackWorkspace(entry.path);
      return true;
    }
    renderRetryBanner(
      tabId,
      async () => {
        clearRetryBanner(tabId);
        await electronAPI.cloneRepo({
          tabId,
          url: entry.url,
          dangerousMode: entry.dangerousMode,
        });
      },
      () => {
        cloningTabs.delete(tabId);
        closeTab(tabId);
      },
    );
    return true;
  }

  function isCloning(tabId) {
    return cloningTabs.has(tabId);
  }

  return { clone, handlePtyExit, isCloning };
}
