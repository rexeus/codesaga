/**
 * Bundles the CLI, its workspace packages, and Effect into one minified
 * `dist/codesaga.js`, so `npx codesaga` never depends on how a consumer's
 * package manager resolves Effect's peer ranges. Only Node built-ins and
 * `oxc-parser` stay external: its native binding cannot be bundled, so it is
 * the package's one runtime dependency. `scripts/verify-bundle-externals.mjs`
 * enforces that.
 */
import { chmod } from "node:fs/promises";
import path from "node:path";

import { rolldown } from "rolldown";

const packageRoot = path.resolve(import.meta.dirname, "..");
const outfile = path.join(packageRoot, "dist/codesaga.js");

const bundle = await rolldown({
  input: path.join(packageRoot, "src/bin.ts"),
  platform: "node",
  external: ["oxc-parser"],
});
try {
  await bundle.write({
    file: outfile,
    format: "esm",
    minify: true,
    codeSplitting: false,
  });
} finally {
  await bundle.close();
}
await chmod(outfile, 0o755);
console.log(`Built ${path.relative(packageRoot, outfile)}.`);
