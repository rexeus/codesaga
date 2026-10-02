// Owns turning one source text into a verdict: facts, or the reason it was skipped.
// The parse itself is injected, so the engine decides what counts and the layer decides how to parse.

import type { SkipReason } from "../report/typescript-deep-dive.js";
import { fileFactsOf } from "./file-facts.js";
import type { FileFacts, ParsedSource } from "./file-facts.js";
import { inputGuardReason } from "./input-guards.js";
import { parseOptionsOf } from "./source-kinds.js";
import type { ParseOptions } from "./source-kinds.js";

/** A file to analyze: its repository-relative path and its text. */
export type SourceText = {
  readonly path: string;
  readonly text: string;
};

/** The verdict on one source. */
export type FactsResult =
  | { readonly kind: "parsed"; readonly facts: FileFacts }
  | { readonly kind: "skipped"; readonly reason: SkipReason };

/** Parses synchronously; it may throw, and it never reports a syntax error as a throw. */
export type ParseSource = (
  path: string,
  text: string,
  options: ParseOptions,
) => ParsedSource;

const skipped = (reason: SkipReason): FactsResult => ({
  kind: "skipped",
  reason,
});

/** A fatal parse leaves nothing of a non-empty source: errors and an empty program. */
const isFatal = (parsed: ParsedSource, text: string): boolean =>
  text !== "" && parsed.errors.length > 0 && parsed.program.body.length === 0;

/**
 * Judges one source: guards first, then a parse and one walk. A source over
 * a guard is `too-large` or `minified` and is never parsed; a fatal syntax
 * error is `syntax-error`; a parse or walk that overflows the stack is
 * `too-deep` and any other failure `parser-error`. Never throws, but cannot
 * survive a parser that kills its process: callers that parse hostile input
 * run this in a process they can lose.
 */
export const factsOfSource = (
  parse: ParseSource,
  { path, text }: SourceText,
): FactsResult => {
  const guarded = inputGuardReason(text);
  if (guarded !== undefined) {
    return skipped(guarded);
  }
  try {
    const parsed = parse(path, text, parseOptionsOf(path));
    return isFatal(parsed, text)
      ? skipped("syntax-error")
      : { kind: "parsed", facts: fileFactsOf(parsed) };
  } catch (error) {
    return skipped(error instanceof RangeError ? "too-deep" : "parser-error");
  }
};
