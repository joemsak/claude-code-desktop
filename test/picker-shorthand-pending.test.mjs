// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPicker } from "../src/renderer/picker.js";

function setupDom() {
  document.body.innerHTML = `
    <div id="picker-overlay" class="hidden">
      <div id="picker-modal">
        <input id="picker-search" />
        <ul id="picker-list"></ul>
      </div>
    </div>
  `;
  return {
    overlay: document.getElementById("picker-overlay"),
    modal: document.getElementById("picker-modal"),
    search: document.getElementById("picker-search"),
    list: document.getElementById("picker-list"),
  };
}

function makePicker({ parseGitUrl } = {}) {
  const dom = setupDom();
  const electronAPI = {
    listWorkspaceDirs: vi.fn(async () => []),
    getRecentWorkspaces: vi.fn(async () => []),
    parseGitUrl: parseGitUrl ?? vi.fn(async () => ({ valid: false })),
  };
  const onClone = vi.fn();
  const picker = createPicker({
    dom,
    electronAPI,
    basename: (p) => p.split("/").pop(),
    getHomePath: () => "/home/user",
    getActiveTab: () => null,
    onSelect: vi.fn(),
    onSelectDangerous: vi.fn(),
    onClone,
    onClose: vi.fn(),
  });
  return { picker, onClone, search: dom.search };
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe("picker GitHub shorthand pending detection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows a pending clone item when typing org/ (slash present, no repo yet)", async () => {
    const { picker, search } = makePicker();
    await picker.open();
    await flush();

    search.value = "myorg/";
    search.dispatchEvent(new Event("input"));
    await flush();

    const cloneItem = document.querySelector(".picker-clone");
    expect(cloneItem).not.toBeNull();
    expect(cloneItem.textContent).toContain("myorg/");
    expect(cloneItem.textContent).not.toContain("into workspace");
  });

  it("shows full clone item once org/repo is complete", async () => {
    const parseGitUrl = vi.fn(async (v) =>
      v === "myorg/myrepo"
        ? { valid: true, url: "https://github.com/myorg/myrepo.git", name: "myrepo" }
        : { valid: false },
    );
    const { picker, search } = makePicker({ parseGitUrl });
    await picker.open();
    await flush();

    search.value = "myorg/myrepo";
    search.dispatchEvent(new Event("input"));
    await flush();

    const cloneItem = document.querySelector(".picker-clone");
    expect(cloneItem).not.toBeNull();
    expect(cloneItem.textContent).toContain("Clone myrepo into workspace");
  });

  it("does not trigger onClone when selecting a pending clone item", async () => {
    const { picker, onClone, search } = makePicker();
    await picker.open();
    await flush();

    search.value = "myorg/";
    search.dispatchEvent(new Event("input"));
    await flush();

    const cloneItem = document.querySelector(".picker-clone");
    expect(cloneItem).not.toBeNull();
    cloneItem.click();
    await flush();

    expect(onClone).not.toHaveBeenCalled();
  });

  it("clears pending clone item when input is just a word without slash", async () => {
    const { picker, search } = makePicker();
    await picker.open();
    await flush();

    search.value = "myorg";
    search.dispatchEvent(new Event("input"));
    await flush();

    const cloneItem = document.querySelector(".picker-clone");
    expect(cloneItem).toBeNull();
  });
});
