// Owns which files of a package an `extends` specifier names, by the package's own manifest.
// Pure over the manifest's JSON: the reader supplies the file system, this module the rules (`exports`, the `tsconfig` field, then the plain path).

/** A bare specifier split into the package name and what follows it, without a leading slash. */
export type PackageSpecifier = {
  readonly name: string;
  readonly subpath: string;
};

/** The package a bare specifier names (`@scope/name` or `name`) and the subpath after it. */
export const splitPackageSpecifier = (specifier: string): PackageSpecifier => {
  const segments = specifier.split("/");
  const nameLength = specifier.startsWith("@") ? 2 : 1;
  return {
    name: segments.slice(0, nameLength).join("/"),
    subpath: segments.slice(nameLength).join("/"),
  };
};

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;

/** Every file name a package `exports` target names: a string, or the strings of its conditions in order. */
const targetsOf = (target: unknown): ReadonlyArray<string> => {
  if (typeof target === "string") {
    return [target];
  }
  return typeof target === "object" && target !== null && !Array.isArray(target)
    ? Object.values(target).flatMap((condition) => targetsOf(condition))
    : [];
};

/** The targets of the `*` pattern of `exports` that `key` matches, with the star filled in. */
const patternTargets = (
  exports: object,
  keys: ReadonlyArray<string>,
  key: string,
): ReadonlyArray<string> => {
  for (const candidate of keys) {
    const star = candidate.indexOf("*");
    const prefix = candidate.slice(0, star);
    const suffix = candidate.slice(star + 1);
    if (
      star >= 0 &&
      key.length >= prefix.length + suffix.length &&
      key.startsWith(prefix) &&
      key.endsWith(suffix)
    ) {
      const matched = key.slice(prefix.length, key.length - suffix.length);
      return targetsOf(field(exports, candidate)).map((target) =>
        target.replace("*", matched),
      );
    }
  }
  return [];
};

/** The target of `exports` for `key` (`.` or `./sub`), looking through a `*` pattern; a conditions-only `exports` is the target of `.`. */
const exportsFor = (exports: unknown, key: string): ReadonlyArray<string> => {
  if (typeof exports === "string") {
    return key === "." ? [exports] : [];
  }
  if (typeof exports !== "object" || exports === null) {
    return [];
  }
  const keys = Object.keys(exports);
  if (!keys.some((candidate) => candidate.startsWith("."))) {
    return key === "." ? targetsOf(exports) : [];
  }
  const exact = field(exports, key);
  if (exact !== undefined) {
    return targetsOf(exact);
  }
  return patternTargets(exports, keys, key);
};

/**
 * The files, relative to the package directory and best first, that an
 * `extends` of `subpath` may name: what `exports` maps it to, for the package
 * itself the `tsconfig` field, then the file as written, with `.json`, or as a
 * directory's `tsconfig.json`.
 */
export const entryCandidates = (
  manifest: unknown,
  subpath: string,
): ReadonlyArray<string> => {
  const mapped = exportsFor(
    field(manifest, "exports"),
    subpath === "" ? "." : `./${subpath}`,
  );
  const tsconfig = field(manifest, "tsconfig");
  const named =
    subpath === "" && typeof tsconfig === "string" ? [tsconfig] : [];
  const plain =
    subpath === ""
      ? ["tsconfig.json"]
      : [subpath, `${subpath}.json`, `${subpath}/tsconfig.json`];
  return [...mapped, ...named, ...plain];
};
