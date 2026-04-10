export function basename(dir) {
  return dir.split("/").pop() || dir;
}

export function getDisplayName(tab, allTabs) {
  if (tab.customName) return tab.customName;
  const base = basename(tab.directory);
  const sameNameTabs = allTabs.filter(
    (t) => !t.customName && basename(t.directory) === base,
  );
  if (sameNameTabs.length <= 1) return base;
  const index = sameNameTabs.indexOf(tab);
  return index === 0 ? base : `${base} (${index + 1})`;
}

export function filterED3(data) {
  const ESC = "\x1b";
  const ED2_ED3 = new RegExp(ESC + "\\[2J" + ESC + "\\[3J", "g");
  return data.replace(ED2_ED3, ESC + "[2J");
}

export function isEffectiveDangerous(shiftHeld, defaultDangerousMode) {
  return shiftHeld !== defaultDangerousMode;
}
