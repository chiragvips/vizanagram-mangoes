import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/index.cjs",
  external: [],
  packages: "bundle",
  banner: {
    js: `"use strict";`,
  },
});
