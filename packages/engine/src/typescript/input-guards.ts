// Owns the checks that run before any parse: a file that fails one is skipped and counted.
// The native parser can crash the process on hostile input, and a crash cannot be caught, so these judge the text alone.

import type { SkipReason } from "../report/typescript-deep-dive.js";
import { deepestNesting } from "./bracket-depth.js";

/** Longer sources are skipped; the universe's own limit, counted in characters. */
const MAX_SOURCE_CHARACTERS = 1_048_576;
/** A source whose non-blank lines average more characters than this counts as minified, as in the universe. */
const MAX_MEAN_LINE_LENGTH = 300;
/** A source with a longer line counts as minified. */
const MAX_LINE_LENGTH = 10_000;
/** Deeper nesting is skipped; real code stays far below, and parsers crash at several thousand levels. */
const MAX_NESTING = 1_000;

const isMinified = (text: string): boolean => {
  let nonBlankLines = 0;
  for (const line of text.split("\n")) {
    if (line.length > MAX_LINE_LENGTH) {
      return true;
    }
    if (line.trim() !== "") {
      nonBlankLines += 1;
    }
  }
  return (
    nonBlankLines > 0 && text.length > MAX_MEAN_LINE_LENGTH * nonBlankLines
  );
};

/**
 * Why a source must not be parsed, or undefined when it may be: it is over
 * 1 MiB, minified, or nests more than 1,000 brackets. Runs in one pass or two
 * over the text and never throws.
 */
export const inputGuardReason = (text: string): SkipReason | undefined => {
  if (text.length > MAX_SOURCE_CHARACTERS) {
    return "too-large";
  }
  if (isMinified(text)) {
    return "minified";
  }
  return deepestNesting(text) > MAX_NESTING ? "too-deep" : undefined;
};
