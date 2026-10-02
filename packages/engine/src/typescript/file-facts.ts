// Owns what the deep dive keeps of one parsed file: small, serialisable facts, never the syntax tree.
// An AST is about a dozen times the source and costs more to move between threads than to parse, so only facts cross the parser's boundary.
// Every fact is a count, or a small list, that adds up over files.

import { ecosystemCollector } from "./ecosystem/hook-facts.js";
import type { EcosystemFacts } from "./ecosystem/hook-facts.js";
import { idiomCollector } from "./idioms/idiom-collector.js";
import type { IdiomFacts } from "./idioms/idiom-facts.js";
import { moduleCollector } from "./modules/module-facts.js";
import type { ModuleFacts } from "./modules/module-facts.js";
import type { ParsedSource } from "./parsed-source.js";
import { typeSafetyCollector } from "./type-safety/type-safety-facts.js";
import type { TypeSafetyFacts } from "./type-safety/type-safety-facts.js";
import { walk } from "./walk.js";

/**
 * The version of `FileFacts`. Facts a cache holds under another version are
 * stale, so it rises with every change to what the facts mean or contain.
 */
const FILE_FACTS_VERSION = 3;

/** The facts of one parsed file. */
export type FileFacts = {
  readonly version: typeof FILE_FACTS_VERSION;
  /** Syntax tree nodes the walk visited: how much code the facts rest on. */
  readonly nodes: number;
  readonly typeSafety: TypeSafetyFacts;
  readonly modules: ModuleFacts;
  readonly idioms: IdiomFacts;
  readonly ecosystem: EcosystemFacts;
};

/**
 * The facts of one parsed file, from a single walk over its program. Pure
 * over the parse and synchronous. Throws a `RangeError` where the tree is
 * nested deeper than the stack allows.
 */
export const fileFactsOf = (parsed: ParsedSource): FileFacts => {
  let nodes = 0;
  const typeSafety = typeSafetyCollector();
  const modules = moduleCollector();
  const idioms = idiomCollector();
  const ecosystem = ecosystemCollector();
  walk(parsed.program, {
    enter: (node) => {
      nodes += 1;
      typeSafety.enter(node);
      modules.enter(node);
      idioms.enter(node);
      ecosystem.enter(node);
    },
  });
  return {
    version: FILE_FACTS_VERSION,
    nodes,
    typeSafety: typeSafety.finish(parsed),
    modules: modules.finish(parsed),
    idioms: idioms.finish(parsed),
    ecosystem: ecosystem.finish(parsed),
  };
};
