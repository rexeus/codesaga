// Owns which universe files an `inspect` argument names: the file itself, files below a matching directory, files a glob matches, or everything for the repository root.
// Pure over repository-relative paths, so the matching is testable without git.

import { ancestorsOf } from "../universe/ancestors.js";
import { matchesAny } from "../universe/globs.js";

/**
 * The paths an argument matches: the file itself, files below a matching
 * directory, and every file when the argument names the repository root
 * (`.`, `./`, `/` or an empty string).
 */
export const pathsMatching = (
  pattern: string,
  paths: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const target = pattern.replace(/\/+$/u, "");
  if (target === "" || target === ".") {
    return paths;
  }
  const matches = matchesAny([target]);
  return paths.filter((path) =>
    [path, ...ancestorsOf(path)].some((candidate) => matches(candidate)),
  );
};
