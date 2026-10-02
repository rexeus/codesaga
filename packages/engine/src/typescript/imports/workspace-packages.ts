// Owns finding the source file a workspace package's name, with or without a subpath, stands for.
// A manifest points at build output (`./dist/index.js`) that a checkout does not hold, so every target is also tried where such a package keeps its source (`src`, or the package directory itself); a name that maps to nothing found stays unresolved.

import type { PackageManifest } from "../ecosystem/read-manifests.js";
import { directoryOf, joinPosix } from "../tsconfig/posix-path.js";
import { exportTargets } from "./exports-map.js";
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

/** What a workspace package is: where its manifest lies and what the manifest says. */
type Package = {
  readonly directory: string;
  readonly entry: PackageManifest["entry"];
};

const withSource = (
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

const entryOf = (
  { directory, entry }: Package,
  subpath: string,
  has: (path: string) => boolean,
): string | undefined => {
  if (entry.exports !== undefined) {
    const key = subpath === "" ? "." : `./${subpath}`;
    const targets = exportTargets(entry.exports, key);
    const mapped = withSource(directory, targets, has);
    return (
      mapped ??
      (subpath === "" && targets.length > 0
        ? withSource(directory, ["./src/index"], has)
        : undefined)
    );
  }
  return subpath === ""
    ? withSource(directory, [...entry.fields, "./src/index", "./index"], has)
    : withSource(directory, [`./${subpath}`, `./src/${subpath}`], has);
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
  const packages = new Map<string, Package>(
    manifests.flatMap(({ name, path, entry }) =>
      name === null
        ? []
        : [[name, { directory: directoryOf(path), entry }] as const],
    ),
  );
  return {
    isWorkspace: (name) => packages.has(name),
    resolve: (name, subpath) => {
      const found = packages.get(name);
      return found === undefined ? undefined : entryOf(found, subpath, has);
    },
  };
};
