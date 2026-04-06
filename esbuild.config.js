const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

esbuild.buildSync({
  entryPoints: ["src/renderer/app.js"],
  bundle: true,
  outfile: "src/renderer/bundle.js",
  format: "iife",
  platform: "browser",
  sourcemap: true,
});

// Copy xterm.css to renderer directory so it works in packaged app
const xtermCssSrc = path.join(
  "node_modules",
  "@xterm",
  "xterm",
  "css",
  "xterm.css",
);
const xtermCssDst = path.join("src", "renderer", "xterm.css");
fs.copyFileSync(xtermCssSrc, xtermCssDst);

// Ensure fonts directory exists in renderer (fonts are checked into src/renderer/fonts/)
const fontsDir = path.join("src", "renderer", "fonts");
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}
