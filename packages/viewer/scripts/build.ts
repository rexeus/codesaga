/**
 * Bundles the browser entry into one minified IIFE and writes `dist/assets.js`,
 * which exports the script and the stylesheet as strings for `renderReportHtml`.
 * Inlining them keeps the report a single file and the CLI bundle free of
 * runtime file reads.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { rolldown } from "rolldown";

const packageRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(packageRoot, "dist");

const bundleScript = async (): Promise<string> => {
  const bundle = await rolldown({
    input: path.join(packageRoot, "src/main.ts"),
    platform: "browser",
  });
  try {
    const { output } = await bundle.generate({ format: "iife", minify: true });
    const [entry] = output;
    if (entry === undefined) {
      throw new Error("rolldown produced no output for src/main.ts.");
    }
    return entry.code;
  } finally {
    await bundle.close();
  }
};

const stylesRoot = path.join(packageRoot, "src/document/styles");

/** Joins `src/document/styles/*.css` in file-name order, then strips comments and whitespace. */
const minifyStyles = async (): Promise<string> => {
  const files = (await readdir(stylesRoot))
    .filter((name) => name.endsWith(".css"))
    .toSorted();
  const sources = await Promise.all(
    files.map((name) => readFile(path.join(stylesRoot, name), "utf8")),
  );
  return sources
    .join("\n")
    .replaceAll(/\/\*[\s\S]*?\*\//gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();
};

/** Text that would end its inline element early must never reach the template. */
const assertInlineSafe = (
  name: string,
  text: string,
  closers: readonly RegExp[],
): void => {
  for (const closer of closers) {
    if (closer.test(text)) {
      throw new Error(
        `${name} contains ${closer}; it cannot be inlined into the page.`,
      );
    }
  }
};

const script = await bundleScript();
const styles = await minifyStyles();
assertInlineSafe("The viewer script", script, [/<\/script/iu, /<!--/u]);
assertInlineSafe("The viewer styles", styles, [/<\/style/iu]);

await mkdir(distRoot, { recursive: true });
await writeFile(
  path.join(distRoot, "assets.js"),
  `export const viewerScript = ${JSON.stringify(script)};\nexport const viewerStyles = ${JSON.stringify(styles)};\n`,
);
await writeFile(
  path.join(distRoot, "assets.d.ts"),
  "export declare const viewerScript: string;\nexport declare const viewerStyles: string;\n",
);
console.log(
  `Built dist/assets.js (${script.length} B script, ${styles.length} B styles).`,
);
