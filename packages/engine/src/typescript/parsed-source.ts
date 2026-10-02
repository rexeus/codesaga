// Owns what the fact extraction reads of a parse, and the shape of one extractor over it.

import type { Node } from "@oxc-project/types";
import type { ParseResult } from "oxc-parser";

/** What `fileFactsOf` reads of a parse: the parser's result, whatever its transfer mode. */
export type ParsedSource = Pick<
  ParseResult,
  "program" | "module" | "comments" | "errors"
>;

/**
 * One kind of fact about a file. `fileFactsOf` shares a single walk among
 * its collectors: each sees every node through `enter`, then `finish` turns
 * what it saw, with the parse's other parts, into its plain facts.
 */
export type FactsCollector<Facts> = {
  readonly enter: (node: Node) => void;
  /** Called for each node after its children, for facts that depend on scope. */
  readonly leave?: ((node: Node) => void) | undefined;
  readonly finish: (parsed: ParsedSource) => Facts;
};
