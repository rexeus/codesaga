// Owns the checks that run before a parse and skip a source that is not worth one.
// Nesting is not judged here: a text scan cannot tell hostile nesting from legitimate code without false skips, so the application isolates the parser in child processes and counts the files that crash it.

import type { SkipReason } from "../report/typescript-deep-dive.js";
import { nonBlankLineCount } from "./text-lines.js";

/** Longer sources are skipped; the universe's own limit, counted in characters. */
export const MAX_SOURCE_CHARACTERS = 1_048_576;
/** A source whose non-blank lines average more characters than this counts as minified, as in the universe. */
export const MAX_MEAN_LINE_LENGTH = 300;

/** The guards' limits, for whoever keeps their verdicts: a verdict outlives the limits it was made under only if they are part of its key. */
export const INPUT_GUARD_LIMITS = {
  maxSourceCharacters: MAX_SOURCE_CHARACTERS,
  maxMeanLineLength: MAX_MEAN_LINE_LENGTH,
} as const;

const isMinified = (text: string): boolean => {
  const nonBlankLines = nonBlankLineCount(text);
  return (
    nonBlankLines > 0 && text.length > MAX_MEAN_LINE_LENGTH * nonBlankLines
  );
};

/**
 * Why a source must not be parsed, or undefined when it may be: it is over
 * 1 MiB, or minified by the universe's rule (non-blank lines average over 300
 * characters, newlines included). Never throws.
 */
export const inputGuardReason = (text: string): SkipReason | undefined => {
  if (text.length > MAX_SOURCE_CHARACTERS) {
    return "too-large";
  }
  return isMinified(text) ? "minified" : undefined;
};
