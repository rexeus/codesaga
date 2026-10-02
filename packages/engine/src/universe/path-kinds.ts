// Owns telling test files and documentation from other paths, for the badges and highlights that read what a commit changed.
// Judged by the path alone, so a file that no longer exists is classified like one that does.
import { matchesAny } from "./globs.js";

// Test directories at any depth and the test file names of the common ecosystems.
const TEST_PATH_PATTERNS = [
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/spec/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*_test.go",
  "**/test_*.py",
  "**/*_test.py",
];

// Documentation directories at any depth and prose file formats.
const DOC_PATH_PATTERNS = [
  "**/docs/**",
  "**/doc/**",
  "**/*.md",
  "**/*.mdx",
  "**/*.rst",
  "**/*.adoc",
  "**/README*",
];

// Release metadata is prose in a docs-looking file format but written by release tooling, not documented by a person.
// Matched on the lowercased path, so `CHANGELOG.md` and `changelog.md` are alike.
const RELEASE_METADATA_PATTERNS = [
  "**/.changeset/**",
  "**/changelog*",
  "**/changes*",
  "**/history*",
  "**/release*",
];

const isReleaseMetadata = matchesAny(RELEASE_METADATA_PATTERNS);
const isDocumentation = matchesAny(DOC_PATH_PATTERNS);

/** Whether a repository-relative path is a test file. */
export const isTestPath: (path: string) => boolean =
  matchesAny(TEST_PATH_PATTERNS);

/**
 * Whether a repository-relative path is documentation written by a person.
 * Release metadata is not: `.changeset/**` and files named `CHANGELOG*`,
 * `CHANGES*`, `HISTORY*`, `RELEASE*` and `RELEASES*` in any directory, in any
 * letter case.
 */
export const isDocPath = (path: string): boolean =>
  isDocumentation(path) && !isReleaseMetadata(path.toLowerCase());
