const esbuild = require("esbuild");

esbuild.buildSync({
  entryPoints: ["src/renderer/app.js"],
  bundle: true,
  outfile: "src/renderer/bundle.js",
  format: "iife",
  platform: "browser",
  sourcemap: true,
});
