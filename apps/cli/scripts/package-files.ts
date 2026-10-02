/**
 * Writes the files npm shows and ships next to the bundle. npm packs only
 * `apps/cli`, so the repository's LICENSE and the third-party notices (the
 * bundled dashboard carries Lucide icons) are copied in, and the README is
 * rewritten with absolute GitHub URLs because npm resolves relative links
 * against the package directory, where the repository's docs do not exist.
 */
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const packageRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const blobBase = "https://github.com/rexeus/codesaga/blob/main/";

/** A markdown link target that is not absolute, an anchor, or a mail link. */
const RELATIVE_LINK = /\]\((?!https?:|#|mailto:)([^)\s]+)\)/gu;

await Promise.all(
  ["LICENSE", "THIRD_PARTY_NOTICES.md"].map((file) =>
    copyFile(path.join(repositoryRoot, file), path.join(packageRoot, file)),
  ),
);

const source = await readFile(path.join(repositoryRoot, "README.md"), "utf8");
const readme = source.replaceAll(
  RELATIVE_LINK,
  (_, target: string) => `](${new URL(target, blobBase).href})`,
);
await writeFile(path.join(packageRoot, "README.md"), readme);
console.log(
  "Wrote LICENSE, THIRD_PARTY_NOTICES.md and README.md for the npm package.",
);
