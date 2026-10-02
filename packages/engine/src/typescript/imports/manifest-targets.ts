// Owns reading a package manifest's `exports` or `imports` field for one key, with the conditions the import graph follows.
// Only `types`, `import` and `default` are followed, in the order the manifest lists them; every other condition is skipped and never guessed at.

const FOLLOWED_CONDITIONS: ReadonlySet<string> = new Set([
  "types",
  "import",
  "default",
]);

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;

const isRecord = (value: unknown): value is object =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The files a target names: a string, the entries of an array, or the followed conditions of an object, in order. */
const targetsOf = (target: unknown): ReadonlyArray<string> => {
  if (typeof target === "string") {
    return [target];
  }
  if (Array.isArray(target)) {
    return target.flatMap((entry: unknown) => targetsOf(entry));
  }
  return isRecord(target)
    ? Object.entries(target).flatMap(([condition, value]) =>
        FOLLOWED_CONDITIONS.has(condition) ? targetsOf(value) : [],
      )
    : [];
};

/** The `*` pattern among `keys` that matches `key` with the longest prefix, with its target's star filled in. */
const patternTargets = (
  exports: object,
  key: string,
): ReadonlyArray<string> => {
  const matches = Object.keys(exports).flatMap((candidate) => {
    const star = candidate.indexOf("*");
    const prefix = candidate.slice(0, star);
    const suffix = candidate.slice(star + 1);
    return star >= 0 &&
      key.length >= prefix.length + suffix.length &&
      key.startsWith(prefix) &&
      key.endsWith(suffix)
      ? [{ candidate, prefix, suffix }]
      : [];
  });
  const best = matches.toSorted(
    (left, right) => right.prefix.length - left.prefix.length,
  )[0];
  if (best === undefined) {
    return [];
  }
  const matched = key.slice(
    best.prefix.length,
    key.length - best.suffix.length,
  );
  return targetsOf(field(exports, best.candidate)).map((target) =>
    target.replaceAll("*", matched),
  );
};

const isKey = (candidate: string): boolean =>
  candidate.startsWith(".") || candidate.startsWith("#");

/**
 * The targets, relative to the package directory as written (`./dist/a.js`),
 * that the field maps `key` (`.`, `./sub` or an `imports` key such as `#a`)
 * to; a target of `imports` may also be a package name. Empty when it maps
 * the key to nothing. A conditions-only `exports` is the target of `.`.
 */
export const manifestTargets = (
  exports: unknown,
  key: string,
): ReadonlyArray<string> => {
  if (typeof exports === "string" || Array.isArray(exports)) {
    return key === "." ? targetsOf(exports) : [];
  }
  if (!isRecord(exports)) {
    return [];
  }
  if (!Object.keys(exports).some((candidate) => isKey(candidate))) {
    return key === "." ? targetsOf(exports) : [];
  }
  const exact = field(exports, key);
  return exact === undefined ? patternTargets(exports, key) : targetsOf(exact);
};
