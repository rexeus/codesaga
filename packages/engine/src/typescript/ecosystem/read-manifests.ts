// Owns reading the `package.json` files of a repository into the few facts the ecosystem block needs.
// The text is untrusted, so each field is read defensively and a manifest that is not an object is skipped.

import { Effect, FileSystem, Path } from "effect";

import { isTestPath } from "../../universe/path-kinds.js";
import { parseJsonc } from "../tsconfig/jsonc.js";
import { typescriptRangeOf } from "../tsconfig/typescript-version.js";

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
  /** The `typescript` range as written, a `catalog:` reference included; null when it declares none. */
  readonly typescript: string | null;
  /** Where the package says its code is, for resolving imports of it. */
  readonly entry: PackageEntry;
};

/** The entry points of a package as written: the `exports` and `imports` fields, and the strings of `types`, `typings`, `module` and `main` that are present, in that order. */
type PackageEntry = {
  readonly exports: unknown;
  readonly imports: unknown;
  readonly fields: ReadonlyArray<string>;
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

const ENTRY_FIELDS = ["types", "typings", "module", "main"] as const;

const entryOf = (json: object): PackageEntry => ({
  exports: field(json, "exports"),
  imports: field(json, "imports"),
  fields: ENTRY_FIELDS.flatMap((key) => {
    const value = field(json, key);
    return typeof value === "string" ? [value] : [];
  }),
});

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
    typescript: typescriptRangeOf(json) ?? null,
    entry: entryOf(json),
  };
};

const READ_CONCURRENCY = 16;

/**
 * The manifests among the project files, those under a test path left out, in
 * path order. One that cannot be read or is not JSON is skipped.
 */
export const readManifests = (
  root: string,
  manifestPaths: ReadonlyArray<string>,
): Effect.Effect<
  ReadonlyArray<PackageManifest>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const paths = manifestPaths
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
