// Tests only: digests that count nothing, except what `counts` says.
import { FILE_DIGEST_VERSION } from "../typescript/digest/file-digest.js";
import type { FileDigest } from "../typescript/digest/file-digest.js";

/** A digest of an empty file, with `counts` on top. */
export const digestWith = (
  counts: Partial<Omit<FileDigest, "version">> = {},
): FileDigest => ({
  version: FILE_DIGEST_VERSION,
  lines: 0,
  any: 0,
  escapes: 0,
  suppressions: 0,
  functions: 0,
  complexFunctions: 0,
  notable: [],
  esm: false,
  commonjs: false,
  testCases: 0,
  focusedTests: 0,
  declarations: 0,
  exportedFunctions: 0,
  ...counts,
});
