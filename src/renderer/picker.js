import { fuzzyMatch, fuzzyScore } from "./fuzzy.js";

/**
 * Creates a directory picker controller.
 * @param {Object} deps
 * @param {Object} deps.dom - DOM element references
 * @param {Object} deps.electronAPI - Electron IPC bridge
 * @param {Function} deps.basename - Path basename utility
 * @param {Function} deps.getHomePath - Returns current home path
 * @param {Function} deps.getActiveTab - Returns currently active tab
 * @param {Function} deps.onSelect - Called with (directory) for normal launch
 * @param {Function} deps.onSelectDangerous - Called with (directory) for dangerous launch
 * @param {Function} deps.onClone - Called with (url) when user picks a clone-URL action
 * @param {Function} deps.onClose - Called when picker closes (e.g. to update empty state)
 */
export function createPicker({
  dom,
  electronAPI,
  basename,
  getHomePath,
  getActiveTab,
  onSelect,
  onSelectDangerous,
  onClone,
  onClose,
}) {
  const { overlay, search, list, modal } = dom;

  let pickerDirs = [];
  let pickerSelectedIndex = 0;
  let dangerousMode = false;
  let cloneCandidate = null;
  let parseToken = 0;
  let mode = "normal";
  const SEARCH_PLACEHOLDER_NORMAL =
    search.getAttribute("placeholder") || "Search workspace...";
  const SEARCH_PLACEHOLDER_URL = "Paste a git URL and press Enter";

  function updateDangerousState(isDangerous) {
    dangerousMode = isDangerous;
    modal.classList.toggle("picker-dangerous", dangerousMode);
  }

  function clearInlineError() {
    const err = document.getElementById("picker-url-error");
    if (err) err.remove();
  }

  function showInlineError(message) {
    clearInlineError();
    const err = document.createElement("div");
    err.id = "picker-url-error";
    err.textContent = message;
    modal.insertBefore(err, list);
  }

  function removeFooters() {
    modal
      .querySelectorAll("#picker-browse-footer, #picker-clone-footer")
      .forEach((el) => el.remove());
  }

  function canDeleteDir(dir) {
    return !!(
      dir &&
      dir.path &&
      !dir.isHome &&
      !dir.isBrowse &&
      !dir.isClone &&
      !dir.isSeparator
    );
  }

  function closeContextMenu() {
    const existing = document.getElementById("picker-context-menu");
    if (existing) existing.remove();
    document.removeEventListener("click", closeContextMenu, true);
    document.removeEventListener("keydown", onContextMenuKey, true);
  }

  function onContextMenuKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeContextMenu();
    }
  }

  async function removeRecent(dir) {
    if (!electronAPI.removeRecentWorkspace) return;
    await electronAPI.removeRecentWorkspace(dir.path);
    await refreshPickerDirs();
    renderList(search.value);
  }

  async function trashWorkspaceDir(dir) {
    if (!electronAPI.trashWorkspace) return;
    const confirmed = window.confirm(`Move “${dir.name}” to the Trash?`);
    if (!confirmed) return;
    await electronAPI.trashWorkspace(dir.path);
    await refreshPickerDirs();
    renderList(search.value);
  }

  function showContextMenu(dir, x, y) {
    if (!canDeleteDir(dir)) return;
    closeContextMenu();
    const menu = document.createElement("div");
    menu.id = "picker-context-menu";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    if (dir.isRecent) {
      const removeItem = document.createElement("div");
      removeItem.className = "picker-context-item";
      removeItem.textContent = "Remove from recents";
      removeItem.addEventListener("click", async (e) => {
        e.stopPropagation();
        closeContextMenu();
        await removeRecent(dir);
      });
      menu.appendChild(removeItem);
    }

    const trashItem = document.createElement("div");
    trashItem.className = "picker-context-item picker-context-item-danger";
    trashItem.innerHTML =
      'Move to Trash <span class="picker-context-shortcut">⌘⌫</span>';
    trashItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeContextMenu();
      await trashWorkspaceDir(dir);
    });
    menu.appendChild(trashItem);

    document.body.appendChild(menu);
    // Clamp to viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 4}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 4}px`;
    }
    setTimeout(() => {
      document.addEventListener("click", closeContextMenu, true);
      document.addEventListener("keydown", onContextMenuKey, true);
    }, 0);
  }

  function enterUrlMode() {
    mode = "url";
    search.dataset.mode = "url";
    search.setAttribute("placeholder", SEARCH_PLACEHOLDER_URL);
    search.value = "";
    cloneCandidate = null;
    list.innerHTML = "";
    removeFooters();
    clearInlineError();
    search.focus();
  }

  function exitUrlMode() {
    mode = "normal";
    search.dataset.mode = "normal";
    search.setAttribute("placeholder", SEARCH_PLACEHOLDER_NORMAL);
    search.value = "";
    cloneCandidate = null;
    clearInlineError();
    renderList("");
    search.focus();
  }

  async function refreshPickerDirs() {
    const [workspaceDirs, recentWorkspaces] = await Promise.all([
      electronAPI.listWorkspaceDirs(),
      electronAPI.getRecentWorkspaces(),
    ]);

    const homePath = getHomePath();
    const recentPaths = new Set();
    const recentItems = [];
    for (const r of recentWorkspaces.slice(0, 5)) {
      recentItems.push({
        name: basename(r.path),
        path: r.path,
        isRecent: true,
      });
      recentPaths.add(r.path);
    }

    const allItems = workspaceDirs
      .filter((d) => !recentPaths.has(d.path))
      .map((d) => ({ name: d.name, path: d.path }));

    pickerDirs = [
      ...recentItems,
      ...(recentItems.length > 0
        ? [{ name: "---", path: null, isSeparator: true }]
        : []),
      { name: "~ (Home)", path: homePath, isHome: true },
      ...allItems,
      { name: "Browse...", path: null, isBrowse: true },
    ];
  }

  async function open(isDangerous = false) {
    dangerousMode = isDangerous;
    updateDangerousState(isDangerous);
    await refreshPickerDirs();

    search.value = "";
    pickerSelectedIndex = 0;
    cloneCandidate = null;
    renderList("");
    overlay.classList.remove("hidden");
    search.focus();
  }

  function close() {
    overlay.classList.add("hidden");
    modal.classList.remove("picker-dangerous");
    removeFooters();
    clearInlineError();
    closeContextMenu();
    mode = "normal";
    search.dataset.mode = "normal";
    search.setAttribute("placeholder", SEARCH_PLACEHOLDER_NORMAL);
    onClose();
    const tab = getActiveTab();
    if (tab) tab.terminal.focus();
  }

  function getFilteredDirs(filter) {
    const cloneItem = cloneCandidate
      ? { isClone: true, url: cloneCandidate.url, name: cloneCandidate.name }
      : null;
    if (!filter) {
      return cloneItem ? [cloneItem, ...pickerDirs] : pickerDirs;
    }
    const seen = new Set();
    const scored = [];
    const browseItem = pickerDirs.find((d) => d.isBrowse);
    for (const d of pickerDirs) {
      if (d.isSeparator || d.isBrowse) continue;
      if (!fuzzyMatch(d.name, filter)) continue;
      if (d.path && seen.has(d.path)) continue;
      if (d.path) seen.add(d.path);
      scored.push({ dir: d, score: fuzzyScore(d.name, filter) });
    }
    scored.sort((a, b) => b.score - a.score);
    const result = scored.map((s) => s.dir);
    if (browseItem) result.push(browseItem);
    return cloneItem ? [cloneItem, ...result] : result;
  }

  function updateSelection() {
    let idx = 0;
    list.querySelectorAll("li").forEach((li) => {
      if (
        li.classList.contains("picker-separator") ||
        li.classList.contains("picker-section-header")
      )
        return;
      li.classList.toggle("selected", idx === pickerSelectedIndex);
      idx++;
    });
    const footer = document.getElementById("picker-browse-footer");
    if (footer) {
      footer.classList.toggle("selected", idx === pickerSelectedIndex);
    }
  }

  function renderList(filter) {
    const filtered = getFilteredDirs(filter);
    list.innerHTML = "";
    removeFooters();

    const browseItem = filtered.find((d) => d.isBrowse);
    const listItems = filtered.filter((d) => !d.isBrowse);

    const selectableCount =
      listItems.filter((d) => !d.isSeparator).length + (browseItem ? 1 : 0);
    if (pickerSelectedIndex >= selectableCount)
      pickerSelectedIndex = Math.max(0, selectableCount - 1);

    const homePath = getHomePath();
    let inRecents = true;
    let headerShown = false;
    let allHeaderShown = false;
    let selectableIndex = 0;
    listItems.forEach((dir) => {
      if (dir.isSeparator) {
        inRecents = false;
        return;
      }

      if (dir.isClone) {
        const idx = selectableIndex++;
        const li = document.createElement("li");
        li.classList.add("picker-clone");
        li.classList.toggle("selected", idx === pickerSelectedIndex);

        const nameSpan = document.createElement("span");
        nameSpan.textContent = `⎘  Clone ${dir.name} into workspace`;
        li.appendChild(nameSpan);

        li.addEventListener("click", () => selectItem(dir));
        li.addEventListener("mouseenter", () => {
          pickerSelectedIndex = idx;
          updateSelection();
        });
        list.appendChild(li);
        return;
      }

      if (!filter) {
        if (inRecents && dir.isRecent && !headerShown) {
          headerShown = true;
          const header = document.createElement("li");
          header.className = "picker-section-header";
          header.textContent = "Recent";
          list.appendChild(header);
        }
        if (!inRecents && !dir.isBrowse && !dir.isHome && !allHeaderShown) {
          allHeaderShown = true;
          const header = document.createElement("li");
          header.className = "picker-section-header";
          header.textContent = "All Workspaces";
          list.appendChild(header);
        }
      }

      const idx = selectableIndex++;
      const li = document.createElement("li");
      if (dir.isRecent) li.classList.add("picker-recent");
      if (dir.isHome) li.classList.add("picker-home");
      li.classList.toggle("selected", idx === pickerSelectedIndex);

      const nameSpan = document.createElement("span");
      nameSpan.textContent = dir.name;
      li.appendChild(nameSpan);

      if (dir.path && !dir.isHome && !dir.isBrowse) {
        const pathSpan = document.createElement("span");
        pathSpan.className = "picker-path";
        pathSpan.textContent = dir.path.replace(homePath, "~");
        li.appendChild(pathSpan);
      }

      li.addEventListener("click", () => selectItem(dir));
      li.addEventListener("mouseenter", () => {
        pickerSelectedIndex = idx;
        updateSelection();
      });
      if (canDeleteDir(dir)) {
        li.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          showContextMenu(dir, e.clientX, e.clientY);
        });
      }
      list.appendChild(li);
    });

    if (browseItem) {
      const browseIdx = selectableIndex++;
      const footer = document.createElement("div");
      footer.id = "picker-browse-footer";
      footer.className = browseIdx === pickerSelectedIndex ? "selected" : "";
      footer.textContent = "Browse\u2026";
      footer.addEventListener("click", () => selectItem(browseItem));
      footer.addEventListener("mouseenter", () => {
        pickerSelectedIndex = browseIdx;
        updateSelection();
      });
      modal.appendChild(footer);
    }

    const cloneFooter = document.createElement("div");
    cloneFooter.id = "picker-clone-footer";
    cloneFooter.textContent = "Clone repo…";
    cloneFooter.addEventListener("click", () => enterUrlMode());
    modal.appendChild(cloneFooter);
  }

  async function selectItem(dir) {
    if (dir.isClone) {
      close();
      if (onClone) onClone(dir.url);
      return;
    }
    close();
    let directory;
    if (dir.isBrowse) {
      directory = await electronAPI.openDirectoryDialog();
      if (!directory) return;
    } else {
      directory = dir.path;
    }
    if (dangerousMode) {
      onSelectDangerous(directory);
    } else {
      onSelect(directory);
    }
  }

  async function refreshCloneCandidate(value) {
    const token = ++parseToken;
    if (!value || !electronAPI.parseGitUrl) {
      cloneCandidate = null;
      return;
    }
    try {
      const result = await electronAPI.parseGitUrl(value);
      if (token !== parseToken) return;
      cloneCandidate = result && result.valid ? result : null;
    } catch {
      if (token !== parseToken) return;
      cloneCandidate = null;
    }
  }

  // Wire up DOM events
  search.addEventListener("input", async () => {
    if (mode === "url") return;
    pickerSelectedIndex = 0;
    const value = search.value;
    await refreshCloneCandidate(value);
    renderList(value);
  });

  search.addEventListener("keydown", async (e) => {
    if (mode === "url") {
      if (e.key === "Escape") {
        e.preventDefault();
        exitUrlMode();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const value = search.value.trim();
        if (!value) return;
        const parsed = electronAPI.parseGitUrl
          ? await electronAPI.parseGitUrl(value)
          : { valid: false };
        if (parsed && parsed.valid) {
          clearInlineError();
          close();
          if (onClone) onClone(parsed.url);
        } else {
          showInlineError("Not a valid git URL");
        }
        return;
      }
      clearInlineError();
      return;
    }

    const selectable = getFilteredDirs(search.value).filter(
      (d) => !d.isSeparator,
    );
    if (e.key === "Backspace" && e.metaKey) {
      const target = selectable[pickerSelectedIndex];
      if (canDeleteDir(target)) {
        e.preventDefault();
        await trashWorkspaceDir(target);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      pickerSelectedIndex = Math.min(
        pickerSelectedIndex + 1,
        selectable.length - 1,
      );
      updateSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      pickerSelectedIndex = Math.max(pickerSelectedIndex - 1, 0);
      updateSelection();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectable[pickerSelectedIndex]) {
        selectItem(selectable[pickerSelectedIndex]);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (selectable[pickerSelectedIndex]) {
        search.value = selectable[pickerSelectedIndex].name;
        pickerSelectedIndex = 0;
        renderList(search.value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  return { open, close, updateDangerousState };
}
