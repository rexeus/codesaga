// Owns what a file adds to a trend point: the counts of its digest that add up over files.
import { memoizedByPath } from "../../universe/memoized-path.js";
import { isToolingPath } from "../../universe/path-kinds.js";
import type { FileDigest } from "../digest/file-digest.js";

const isTooling = memoizedByPath(isToolingPath);

/** The measures of a trend, in the order `countsOf` lists them; `tests.testCases` and `tests.focusedTests` exist for test files only. */
export const MEASURES = [
  "files",
  "lines",
  "any",
  "escapes",
  "suppressions",
  "functions",
  "complexFunctions",
  "esmFiles",
  "commonjsFiles",
  "testCases",
  "focusedTests",
] as const;

/**
 * One file's counts, aligned with `MEASURES`. A tooling file, such as
 * `jest.config.js`, is CommonJS by convention and says nothing of the
 * project's module system, so it adds to neither module series.
 */
export const countsOf = (
  digest: FileDigest,
  path: string,
): ReadonlyArray<number> => {
  const counted = !isTooling(path);
  return [
    1,
    digest.lines,
    digest.any,
    digest.escapes,
    digest.suppressions,
    digest.functions,
    digest.complexFunctions,
    counted && digest.esm ? 1 : 0,
    counted && digest.commonjs ? 1 : 0,
    digest.testCases,
    digest.focusedTests,
  ];
};
