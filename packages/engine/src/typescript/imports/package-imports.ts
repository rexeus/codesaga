// Owns resolving a `#` specifier through the `imports` field of the nearest `package.json`, as Node does.
// Exact keys and `*` patterns, with the conditions `exports` follows; a target that names a package is outside the repository.

import type { PackageManifest } from "../ecosystem/read-manifests.js";
import { directoryOf } from "../tsconfig/posix-path.js";
import { manifestTargets } from "./manifest-targets.js";
import { sourceOfTargets } from "./package-targets.js";
import type { Resolution } from "./resolve.js";

const isInside = (directory: string, file: string): boolean =>
  directory === "" || file.startsWith(`${directory}/`);

/**
 * A function from the file that names a `#` specifier and the specifier to
 * what it stands for: a file, a package outside the repository, or
 * unresolved when the nearest manifest does not map it or maps it to nothing
 * found.
 */
export const packageImportsResolver = (
  manifests: ReadonlyArray<PackageManifest>,
  has: (path: string) => boolean,
): ((from: string, specifier: string) => Resolution) => {
  const nearestFirst = manifests
    .map((manifest) => ({ manifest, directory: directoryOf(manifest.path) }))
    .toSorted((left, right) => right.directory.length - left.directory.length);
  return (from, specifier) => {
    const nearest = nearestFirst.find(({ directory }) =>
      isInside(directory, from),
    );
    if (nearest === undefined) {
      return { kind: "unresolved" };
    }
    const targets = manifestTargets(nearest.manifest.entry.imports, specifier);
    const found = sourceOfTargets(
      nearest.directory,
      targets.filter((target) => target.startsWith("./")),
      has,
    );
    if (found !== undefined) {
      return { kind: "file", path: found };
    }
    return targets.some((target) => !target.startsWith("./"))
      ? { kind: "external" }
      : { kind: "unresolved" };
  };
};
