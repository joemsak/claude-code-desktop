function fuzzyMatch(text, pattern) {
  let ti = 0;
  let pi = 0;
  text = text.toLowerCase();
  pattern = pattern.toLowerCase();
  while (ti < text.length && pi < pattern.length) {
    if (text[ti] === pattern[pi]) pi++;
    ti++;
  }
  return pi === pattern.length;
}

function fuzzyScore(text, pattern) {
  text = text.toLowerCase();
  pattern = pattern.toLowerCase();
  let score = 0;
  let ti = 0;
  let prevMatch = -1;
  for (let pi = 0; pi < pattern.length; pi++) {
    while (ti < text.length && text[ti] !== pattern[pi]) ti++;
    if (ti >= text.length) return -1;
    // Bonus for consecutive matches
    if (ti === prevMatch + 1) score += 5;
    // Bonus for matching at start or after separator
    if (
      ti === 0 ||
      text[ti - 1] === "-" ||
      text[ti - 1] === "/" ||
      text[ti - 1] === "_"
    )
      score += 3;
    prevMatch = ti;
    ti++;
  }
  // Prefer shorter names (closer match)
  score -= text.length * 0.1;
  return score;
}

export { fuzzyMatch, fuzzyScore };
