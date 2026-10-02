// Owns recognizing the comments that switch the checker or the linter off.
// Reads the parser's comments, never the source text, so a directive inside a string or a template is not one.

import type { ParsedSource } from "../parsed-source.js";

/** The TypeScript directive comments, which count only at the start of a comment; `///` and a JSDoc star may precede them. */
const TS_DIRECTIVE = /^[\s*/]*@ts-(ignore|expect-error|nocheck)(?![\w-])/u;
/** `eslint-disable`, its `-line` and `-next-line` forms, `oxlint-disable*` and `biome-ignore`; `eslint-enable` re-enables and is not one. */
const LINT_DISABLE =
  /^[\s*]*(?:eslint-disable|oxlint-disable|biome-ignore)(?![\w])/u;

/** How many of each directive a file's comments hold. */
export type SuppressionCounts = {
  readonly tsIgnore: number;
  readonly tsExpectError: number;
  readonly tsNocheck: number;
  readonly lintDisables: number;
};

/** Counts the suppression directives among the comments of a parse. */
export const suppressionsOf = (
  comments: ParsedSource["comments"],
): SuppressionCounts => {
  let tsIgnore = 0;
  let tsExpectError = 0;
  let tsNocheck = 0;
  let lintDisables = 0;
  for (const { value } of comments) {
    const directive = TS_DIRECTIVE.exec(value)?.[1];
    if (directive === "ignore") {
      tsIgnore += 1;
    } else if (directive === "expect-error") {
      tsExpectError += 1;
    } else if (directive === "nocheck") {
      tsNocheck += 1;
    } else if (LINT_DISABLE.test(value)) {
      lintDisables += 1;
    }
  }
  return { tsIgnore, tsExpectError, tsNocheck, lintDisables };
};
