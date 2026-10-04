// Owns the shape of the `deepDives.typescript` section: what the TypeScript and JavaScript analysis rests on.
// Later blocks of the deep dive join as further optional keys beside `coverage`.
import { Schema } from "effect";

import { TypeScriptAchievement } from "./typescript-achievements.js";
import { Ecosystem } from "./typescript-ecosystem.js";
import { ComplexityAndChange, Functions } from "./typescript-functions.js";
import { Idioms } from "./typescript-idioms.js";
import { Imports } from "./typescript-imports.js";
import { Markers } from "./typescript-markers.js";
import { Modules } from "./typescript-modules.js";
import { Strictness } from "./typescript-strictness.js";
import { Tests } from "./typescript-tests.js";
import { Trends } from "./typescript-trends.js";
import { TypeSafety } from "./typescript-type-safety.js";

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
   * `parser-crashed` a file that killed or hung the parser's process (found
   * by bisecting, so the others of its batch were still parsed), `unreadable` a
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
  /** Escape hatches and their counterparts. Absent when no file was parsed, and so for every block below. */
  typeSafety: Schema.optionalKey(TypeSafety),
  /** The compiler posture of each `tsconfig`. */
  strictness: Schema.optionalKey(Strictness),
  /** The module systems in use. */
  modules: Schema.optionalKey(Modules),
  /** Paired counts of ways of writing the same thing, in production code. */
  idioms: Schema.optionalKey(Idioms),
  /** The frameworks and tools in use. */
  ecosystem: Schema.optionalKey(Ecosystem),
  /** Cognitive complexity and shape of the functions. */
  functions: Schema.optionalKey(Functions),
  /** The revisions that landed in the hardest files. */
  complexityAndChange: Schema.optionalKey(ComplexityAndChange),
  /** The test cases and how they are marked. */
  tests: Schema.optionalKey(Tests),
  /** Debt markers and documented exports of production code. */
  markers: Schema.optionalKey(Markers),
  /** How the code imports itself: cycles, fan-in and fan-out of files, and the territories' dependency map. */
  imports: Schema.optionalKey(Imports),
  /** The code over the whole history; absent when the history was not parsed (the parser did not load, or the run was a `check`), and when no file of it parsed. */
  trends: Schema.optionalKey(Trends),
  /** The milestones of its type safety and module system; absent without a production TypeScript file. */
  achievements: Schema.optionalKey(Schema.Array(TypeScriptAchievement)),
});
export type TypeScriptDeepDive = typeof TypeScriptDeepDive.Type;

/**
 * The language analyses beyond the code stats, one optional block per
 * language; a block is absent when the universe has no file of its language.
 */
export const DeepDives = Schema.Struct({
  typescript: Schema.optionalKey(TypeScriptDeepDive),
});
