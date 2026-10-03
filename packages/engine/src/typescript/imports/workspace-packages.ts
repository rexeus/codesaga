// Owns finding the source file a workspace package's name, with or without a subpath, stands for.
// A name that maps to nothing found stays unresolved; the manifest's targets are read by `sourceOfTargets`.

import type { PackageManifest } from "../ecosystem/read-manifests.js";
import { directoryOf } from "../tsconfig/posix-path.js";
import { manifestTargets } from "./manifest-targets.js";
import { sourceOfTargets } from "./package-targets.js";

/** What a workspace package is: where its manifest lies and what the manifest says. */
type Package = {
  readonly directory: string;
  readonly entry: PackageManifest["entry"];
};

const entryOf = (
  { directory, entry }: Package,
  subpath: string,
  has: (path: string) => boolean,
): string | undefined => {
  if (entry.exports !== undefined) {
    const key = subpath === "" ? "." : `./${subpath}`;
    const targets = manifestTargets(entry.exports, key);
    const mapped = sourceOfTargets(directory, targets, has);
    return (
      mapped ??
      (subpath === "" && targets.length > 0
        ? sourceOfTargets(directory, ["./src/index"], has)
        : undefined)
    );
  }
  return subpath === ""
    ? sourceOfTargets(
        directory,
        [...entry.fields, "./src/index", "./index"],
        has,
      )
    : sourceOfTargets(directory, [`./${subpath}`, `./src/${subpath}`], has);
};

/** The packages by name; where two manifests share a name the one with the shortest path wins, then the first in path order. */
const packagesOf = (
  manifests: ReadonlyArray<PackageManifest>,
): ReadonlyMap<string, Package> => {
  const packages = new Map<string, Package>();
  const ordered = manifests.toSorted(
    (left, right) =>
      left.path.length - right.path.length ||
      Number(left.path > right.path) - Number(left.path < right.path),
  );
  for (const { name, path, entry } of ordered) {
    if (name !== null && !packages.has(name)) {
      packages.set(name, { directory: directoryOf(path), entry });
    }
  }
  return packages;
};

/**
 * Resolves a workspace package: `resolve(name, subpath)` is the source file of
 * the package called `name` that `subpath` (without a leading slash, empty
 * for the package itself) stands for. Undefined for a name that is no
 * workspace package and for one whose manifest maps the subpath to nothing
 * found. `has` says which repository files exist.
 */
export const workspaceResolver = (
  manifests: ReadonlyArray<PackageManifest>,
  has: (path: string) => boolean,
): {
  readonly isWorkspace: (name: string) => boolean;
  readonly resolve: (name: string, subpath: string) => string | undefined;
} => {
  const packages = packagesOf(manifests);
  return {
    isWorkspace: (name) => packages.has(name),
    resolve: (name, subpath) => {
      const found = packages.get(name);
      return found === undefined ? undefined : entryOf(found, subpath, has);
    },
  };
};
