// Owns finding the source file a package manifest's target stands for, where the manifest names build output.
// A manifest points at `./dist/index.js`, which a checkout does not hold, so every target is also tried where such a package keeps its source (`src`, or the package directory itself); a target that is found nowhere stays unfound and is never guessed.

import type { PackageManifest } from "../ecosystem/read-manifests.js";
import { directoryOf, joinPosix } from "../tsconfig/posix-path.js";
import { sourceFileOf, withoutScriptExtension } from "./source-file.js";

const OUTPUT_DIRECTORIES: ReadonlySet<string> = new Set([
  "dist",
  "build",
  "lib",
  "out",
  "esm",
  "cjs",
  "es",
  "types",
]);

/** `path` below `directory`; a path that climbs out of the package is dropped. */
const below = (directory: string, path: string): string | undefined => {
  const joined = joinPosix(directory, path);
  return directory === "" || joined.startsWith(`${directory}/`)
    ? joined
    : undefined;
};

/** The places a package-relative target may stand for: as written, with its output directory replaced by `src`, and with it removed, for a package whose sources lie beside its output. */
const placesOf = (directory: string, target: string): ReadonlyArray<string> => {
  const relative = withoutScriptExtension(target.replace(/^\.\//u, ""));
  const [first = "", ...rest] = relative.split("/");
  const places = [relative];
  if (rest.length > 0 && OUTPUT_DIRECTORIES.has(first)) {
    places.push(["src", ...rest].join("/"), rest.join("/"));
  }
  return places.flatMap((place) => below(directory, place) ?? []);
};

/**
 * The first source file that one of the package-relative `targets` of the
 * package at `directory` stands for, among the files `has` knows.
 */
export const sourceOfTargets = (
  directory: string,
  targets: ReadonlyArray<string>,
  has: (path: string) => boolean,
): string | undefined => {
  for (const target of targets) {
    for (const place of placesOf(directory, target)) {
      const found = sourceFileOf(place, has);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
};

/**
 * A function from a directory to the source file that the `types`, `module` or
 * `main` field of the `package.json` in it names; undefined for a directory
 * without a manifest or whose fields lead to no file.
 */
export const directoryEntries = (
  manifests: ReadonlyArray<PackageManifest>,
  has: (path: string) => boolean,
): ((directory: string) => string | undefined) => {
  const manifestAt = new Map(
    manifests.map((manifest) => [directoryOf(manifest.path), manifest]),
  );
  return (directory) => {
    const manifest = manifestAt.get(directory);
    return manifest === undefined
      ? undefined
      : sourceOfTargets(directory, manifest.entry.fields, has);
  };
};
