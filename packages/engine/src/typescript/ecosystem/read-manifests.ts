// Owns reading the `package.json` files of a repository into the few facts the ecosystem block needs.
// The text is untrusted, so each field is read defensively and a manifest that is not an object is skipped.

import { Effect, FileSystem, Path } from "effect";

import { isTestPath } from "../../universe/path-kinds.js";
import { parseJsonc } from "../tsconfig/jsonc.js";

/** What a `package.json` declares, as far as the ecosystem block reads it. */
export type PackageManifest = {
  /** Repository-relative path of the file. */
  readonly path: string;
  /** The package's own name; null when it has none. */
  readonly name: string | null;
  /** `"type": "module"` or `"commonjs"`; null when absent or anything else. */
  readonly type: "module" | "commonjs" | null;
  /** Names in `dependencies` and `optionalDependencies`. */
  readonly dependencies: ReadonlyArray<string>;
  readonly devDependencies: ReadonlyArray<string>;
  readonly peerDependencies: ReadonlyArray<string>;
};

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;

/** Names of the entries whose range is not a `workspace:` link: those are the repository's own packages. */
const externalNames = (value: unknown): ReadonlyArray<string> =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([name, range]) =>
        typeof range === "string" && range.startsWith("workspace:")
          ? []
          : [name],
      )
    : [];

/** The manifest the text declares, or undefined when it is not a JSON object. */
const manifestOf = (
  path: string,
  text: string,
): PackageManifest | undefined => {
  const json = parseJsonc(text);
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return undefined;
  }
  const name = field(json, "name");
  const type = field(json, "type");
  return {
    path,
    name: typeof name === "string" ? name : null,
    type: type === "module" || type === "commonjs" ? type : null,
    dependencies: [
      ...externalNames(field(json, "dependencies")),
      ...externalNames(field(json, "optionalDependencies")),
    ],
    devDependencies: externalNames(field(json, "devDependencies")),
    peerDependencies: externalNames(field(json, "peerDependencies")),
  };
};

const READ_CONCURRENCY = 16;

/**
 * The manifests among the tracked files, tests' fixtures left out, in path
 * order. One that cannot be read or is not JSON is skipped.
 */
export const readManifests = (
  root: string,
  tracked: ReadonlyArray<string>,
): Effect.Effect<
  ReadonlyArray<PackageManifest>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const paths = tracked
      .filter(
        (file) =>
          (file === "package.json" || file.endsWith("/package.json")) &&
          !isTestPath(file),
      )
      .toSorted();
    const manifests = yield* Effect.forEach(
      paths,
      (file) =>
        fs.readFileString(path.join(root, file)).pipe(
          Effect.map((text) => manifestOf(file, text)),
          Effect.orElseSucceed(() => undefined),
        ),
      { concurrency: READ_CONCURRENCY },
    );
    return manifests.filter((manifest) => manifest !== undefined);
  });
