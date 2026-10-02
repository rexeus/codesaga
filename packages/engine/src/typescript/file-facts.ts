// Owns what the deep dive keeps of one parsed file: small, serialisable facts, never the syntax tree.
// An AST is about a dozen times the source and costs more to move between threads than to parse, so only facts cross the parser's boundary.

import type { ParseResult } from "oxc-parser";

import { walk } from "./walk.js";

/**
 * The version of `FileFacts`. Facts a cache holds under another version are
 * stale, so it rises with every change to what the facts mean or contain.
 */
const FILE_FACTS_VERSION = 1;

/** The facts of one parsed file. */
export type FileFacts = {
  readonly version: typeof FILE_FACTS_VERSION;
  /** Syntax tree nodes the walk visited: how much code the facts rest on. */
  readonly nodes: number;
};

/** What `fileFactsOf` reads of a parse: the parser's result, whatever its transfer mode. */
export type ParsedSource = Pick<
  ParseResult,
  "program" | "module" | "comments" | "errors"
>;

/**
 * The facts of one parsed file, from a single walk over its program. Pure
 * over the parse and synchronous. Throws a `RangeError` where the tree is
 * nested deeper than the stack allows.
 */
export const fileFactsOf = (parsed: ParsedSource): FileFacts => {
  let nodes = 0;
  walk(parsed.program, {
    enter: () => {
      nodes += 1;
    },
  });
  return { version: FILE_FACTS_VERSION, nodes };
};
