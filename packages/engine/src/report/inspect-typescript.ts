// Owns what `inspect` says of the TypeScript and JavaScript files an argument matches: complexity, escape hatches, who imports them and which tests do.
// Counts and names, never a verdict; it reads the files as the analysis does, at HEAD and without a type checker.
import { Schema } from "effect";

import { TerritoryStrict } from "./typescript-strictness.js";

const Count = Schema.Natural;

/** A file list with its size: the count is exact, the paths are the first few in path order. */
const FileList = Schema.Struct({
  files: Count,
  /** At most five paths, sorted. */
  top: Schema.Array(Schema.String).check(Schema.isMaxLength(5)),
});

/**
 * The matched files that are TypeScript or JavaScript, as the deep dive
 * reads them. Present only when the argument matches at least one such file.
 */
export const InspectTypeScript = Schema.Struct({
  /** Matched files that were parsed. */
  files: Count,
  /** Matched files that were not: declaration files, and files the parser skipped (`deepDives.typescript.coverage.skipped` says why). */
  unparsed: Count,
  /** The highest cognitive complexity of a function in the parsed files; 0 without a function. */
  maxComplexity: Count,
  /** Functions at or above `thresholds.typescript.complexityLimit` in the parsed files. */
  complexFunctions: Count,
  /** The three hardest of them, hardest first, then by path and line. */
  hardest: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      path: Schema.String,
      /** The line the function starts on, 1-based. */
      line: Count,
      complexity: Count,
    }),
  ).check(Schema.isMaxLength(3)),
  /** Escape sites in the parsed files, as `deepDives.typescript.typeSafety` counts them. */
  escapes: Count,
  /** `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck` comments in the parsed files. */
  directives: Count,
  /** The production files outside the matched ones that import a matched file, by value or as types. */
  importedBy: FileList,
  /** The test files that import a matched production file; a test file inside the match counts. */
  testedBy: FileList,
  /** `strict` as the configs that govern the matched files set it; absent when no config governs one. */
  strict: Schema.optionalKey(TerritoryStrict),
});
export type InspectTypeScript = typeof InspectTypeScript.Type;
