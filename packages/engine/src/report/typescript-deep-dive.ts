// Owns the shape of the `deepDives.typescript` section: what the TypeScript and JavaScript analysis rests on.
// Later blocks of the deep dive join as further optional keys beside `coverage`.
import { Schema } from "effect";

const Count = Schema.Natural;

/** Why a file was not analyzed. */
export const SkipReason = Schema.Literals([
  "too-large",
  "minified",
  "too-deep",
  "syntax-error",
  "parser-error",
  "parser-crashed",
  "unreadable",
  "parser-unavailable",
]);
export type SkipReason = typeof SkipReason.Type;

/**
 * What the deep dive could read. `files` counts the universe's TypeScript and
 * JavaScript files, so `files` is `parsed` plus `declarationFiles` plus the
 * `skipped` counts: no figure of the deep dive silently rests on a subset.
 */
const Coverage = Schema.Struct({
  /** Universe files of the TypeScript and JavaScript languages. */
  files: Count,
  /** Files parsed into facts. */
  parsed: Count,
  /** Declaration files (`.d.ts`, `.d.mts`, `.d.cts`): counted, never parsed. */
  declarationFiles: Count,
  /**
   * Files skipped by reason, only the reasons that occurred. `too-large` is
   * over 1 MiB, `minified` has lines averaging over 300 characters, `too-deep`
   * is a tree nested deeper than the stack allows, `syntax-error` is a fatal
   * parse error, `parser-error` an unexpected failure of the parser,
   * `parser-crashed` a file that killed the parser's process (found by
   * bisecting, so the others of its batch were still parsed), `unreadable` a
   * file that could not be read, and `parser-unavailable` says the parser did
   * not load.
   */
  skipped: Schema.Record(SkipReason, Schema.optionalKey(Count)),
  /** The parser the facts come from; `version` is null when it did not load. */
  parser: Schema.Struct({
    name: Schema.String,
    version: Schema.NullOr(Schema.String),
  }),
  /** Why the parser did not load, in its own words; absent when it did. */
  unavailable: Schema.optionalKey(Schema.String),
});

/** Analysis of the repository's TypeScript and JavaScript at HEAD. */
export const TypeScriptDeepDive = Schema.Struct({
  coverage: Coverage,
});
export type TypeScriptDeepDive = typeof TypeScriptDeepDive.Type;

/**
 * The language analyses beyond the code stats, one optional block per
 * language; a block is absent when the universe has no file of its language.
 */
export const DeepDives = Schema.Struct({
  typescript: Schema.optionalKey(TypeScriptDeepDive),
});
