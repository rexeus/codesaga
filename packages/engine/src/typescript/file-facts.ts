// Owns what the deep dive keeps of one parsed file: small, serialisable facts, never the syntax tree.
// An AST is about a dozen times the source and costs more to move between threads than to parse, so only facts cross the parser's boundary.
// Every fact is a count, or a small list, that adds up over files.

import type { ParsedSource } from "./parsed-source.js";
import { typeSafetyCollector } from "./type-safety/type-safety-facts.js";
import type { TypeSafetyFacts } from "./type-safety/type-safety-facts.js";
import { walk } from "./walk.js";

/**
 * The version of `FileFacts`. Facts a cache holds under another version are
 * stale, so it rises with every change to what the facts mean or contain.
 */
const FILE_FACTS_VERSION = 2;

/** The facts of one parsed file. */
export type FileFacts = {
  readonly version: typeof FILE_FACTS_VERSION;
  /** Syntax tree nodes the walk visited: how much code the facts rest on. */
  readonly nodes: number;
  readonly typeSafety: TypeSafetyFacts;
};

/**
 * The facts of one parsed file, from a single walk over its program. Pure
 * over the parse and synchronous. Throws a `RangeError` where the tree is
 * nested deeper than the stack allows.
 */
export const fileFactsOf = (parsed: ParsedSource): FileFacts => {
  let nodes = 0;
  const typeSafety = typeSafetyCollector();
  walk(parsed.program, {
    enter: (node) => {
      nodes += 1;
      typeSafety.enter(node);
    },
  });
  return {
    version: FILE_FACTS_VERSION,
    nodes,
    typeSafety: typeSafety.finish(parsed),
  };
};
