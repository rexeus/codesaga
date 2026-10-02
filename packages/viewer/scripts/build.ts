/**
 * Inlines the Lucide icons the page draws, bundles the browser entry into one
 * minified IIFE and writes `dist/assets.js`, which exports the script and the
 * stylesheet as strings for `renderReportHtml`. Inlining them keeps the report
 * a single file and the CLI bundle free of runtime file reads.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { rolldown } from "rolldown";

import { ICON_NAMES } from "../src/present/icons.js";
import { readIconShapes, readLucideLicense } from "./lucide.js";

const packageRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(packageRoot, "dist");
const noticesPath = path.resolve(packageRoot, "../../THIRD_PARTY_NOTICES.md");

/**
 * The shapes of `ICON_NAMES` as `src/render/lucide-shapes.js`, which
 * `src/render/icons.ts` bundles; the committed `lucide-shapes.d.ts` types it,
 * so lint and typecheck need no build. Only the used icons are in it, so the
 * page carries no others.
 */
const writeIcons = async (): Promise<void> => {
  const shapes = await readIconShapes(ICON_NAMES);
  await writeFile(
    path.join(packageRoot, "src/render/lucide-shapes.js"),
    `export const lucideShapes = ${JSON.stringify(shapes)};\n`,
  );
};

/**
 * The comment that opens the script: Lucide's license, which asks to appear in
 * every copy of the icons. `THIRD_PARTY_NOTICES.md` ships it beside the CLI;
 * the build fails when that file lacks the license the pinned package carries.
 */
const licenseBanner = async (): Promise<string> => {
  const license = await readLucideLicense();
  if (!(await readFile(noticesPath, "utf8")).includes(license)) {
    throw new Error(
      "THIRD_PARTY_NOTICES.md does not contain the license of lucide-static; copy its LICENSE there.",
    );
  }
  return `/*! Lucide icons, inlined from lucide-static.\n\n${license}\n*/`;
};

const bundleScript = async (): Promise<string> => {
  const bundle = await rolldown({
    input: path.join(packageRoot, "src/main.ts"),
    platform: "browser",
  });
  try {
    const { output } = await bundle.generate({
      format: "iife",
      minify: true,
      banner: await licenseBanner(),
    });
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

await mkdir(distRoot, { recursive: true });
await writeIcons();
const script = await bundleScript();
const styles = await minifyStyles();
assertInlineSafe("The viewer script", script, [/<\/script/iu, /<!--/u]);
assertInlineSafe("The viewer styles", styles, [/<\/style/iu]);

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
