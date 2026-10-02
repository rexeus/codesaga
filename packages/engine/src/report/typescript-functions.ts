// Owns the shape of `deepDives.typescript.functions` and `complexityAndChange`: how complex, long and wide the functions are, and where complexity meets change.
// Cognitive complexity is the SonarSource whitepaper's (v1.7). Distributions and top lists, never a score; production code and tests are reported apart.
import { Schema } from "effect";

const Count = Schema.Natural;
const Share = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/** A function by name, where it is and how it scores. */
const FunctionEntry = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  /** The line the function starts on, 1-based. */
  line: Count,
  complexity: Count,
  /** Non-blank lines of the function, the functions inside it included, though their structures are not scored in it. */
  lines: Count,
});

/**
 * The functions of one set of parsed files: every function, callbacks and
 * nested functions included, scored from its own body. The structures of a
 * function nested in another are the nested one's, and the function around it
 * adds no nesting, which is how eslint-plugin-sonarjs reports a function.
 * `??` and `?.` add nothing, and recursion counts for a direct call by the
 * function's own name. React components score what their JSX conditionals add;
 * they are not treated apart.
 */
const FunctionsPart = Schema.Struct({
  /** Parsed files in the set. */
  files: Count,
  /** Non-blank lines of those files. */
  codeLines: Count,
  /** Functions in the set, the denominator of every share here. */
  functions: Count,
  complexity: Schema.Struct({
    /** Functions per complexity band: 0–4, 5–9, 10–14, 15–24, 25 or more. */
    bands: Schema.Array(Count),
    /** The 50th percentile of the scores, interpolated between ranks. */
    p50: Schema.Finite,
    /** The 90th percentile of the scores, interpolated between ranks. */
    p90: Schema.Finite,
    max: Count,
  }),
  /** Functions at or above Sonar's default limit of 15: the last two bands. */
  over15: Schema.Struct({
    functions: Count,
    /** `functions` over all functions of the set; 0 for none. */
    share: Share,
    /** Non-blank lines inside those functions, a function inside another one of them counted once. */
    lines: Count,
    /** `lines` over `codeLines`, how much of the code sits in them; 0 for none. */
    lineShare: Share,
  }),
  /** The five hardest functions, hardest first, then by path and line. */
  top: Schema.Array(FunctionEntry).check(Schema.isMaxLength(5)),
  /** Functions per length band in non-blank lines: 1–15, 16–30, 31–60, 61 or more. */
  lengths: Schema.Array(Count),
  /** Functions with more than 4 parameters; a destructured parameter counts once. */
  longParameterLists: Count,
  /** The deepest nesting of control structures within any one function. */
  maxDepth: Count,
});
export type FunctionsPart = typeof FunctionsPart.Type;

/** Cognitive complexity and shape of the parsed functions. */
export const Functions = Schema.Struct({
  /** Files that are not tests, by the path rule of the `well-tested` badge. */
  production: FunctionsPart,
  /** Test files. */
  tests: FunctionsPart,
});
export type Functions = typeof Functions.Type;

/**
 * Where complexity meets change, over the production files that hold a
 * function. A file's complexity is that of its hardest function, so size does
 * not inflate it.
 */
export const ComplexityAndChange = Schema.Struct({
  /** Production files with at least one function: the denominator. */
  files: Count,
  /** Revisions of those files in the current life of each path, summed. */
  revisions: Count,
  /** Files whose hardest function scores 15 or more. */
  complexFiles: Count,
  /** Revisions that landed in those files. */
  complexRevisions: Count,
  /** `complexRevisions` over `revisions`; 0 for none. */
  complexRevisionShare: Share,
  /**
   * Up to five files in the top decile of both hardest-function complexity and
   * revisions among those files, and whose hardest function is no easier than
   * `thresholds.typescript.hotspotMinComplexity`; most revisions first, then
   * hardest, then by path.
   */
  hotspots: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      /** The score of the file's hardest function. */
      complexity: Count,
      revisions: Count,
    }),
  ).check(Schema.isMaxLength(5)),
});
export type ComplexityAndChange = typeof ComplexityAndChange.Type;
