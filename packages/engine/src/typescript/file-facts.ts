// Owns what the deep dive keeps of one parsed file: small, serialisable facts, never the syntax tree.
// An AST is about a dozen times the source and costs more to move between threads than to parse, so only facts cross the parser's boundary.
// Every fact is a count, or a small list, that adds up over files.

import { ecosystemCollector } from "./ecosystem/hook-facts.js";
import type { EcosystemFacts } from "./ecosystem/hook-facts.js";
import { functionCollector } from "./functions/function-collector.js";
import type { FunctionFacts } from "./functions/function-facts.js";
import { idiomCollector } from "./idioms/idiom-collector.js";
import type { IdiomFacts } from "./idioms/idiom-facts.js";
import { markersOf } from "./markers/marker-facts.js";
import type { MarkerFacts } from "./markers/marker-facts.js";
import { moduleCollector } from "./modules/module-facts.js";
import type { ModuleFacts } from "./modules/module-facts.js";
import type { ParsedSource } from "./parsed-source.js";
import { testCollector } from "./tests/test-facts.js";
import type { TestFacts } from "./tests/test-facts.js";
import { typeSafetyCollector } from "./type-safety/type-safety-facts.js";
import type { TypeSafetyFacts } from "./type-safety/type-safety-facts.js";
import { walk } from "./walk.js";

/**
 * The version of `FileFacts`. Facts a cache holds under another version are
 * stale, so it rises with every change to what the facts mean or contain.
 */
const FILE_FACTS_VERSION = 10;

/** The facts of one parsed file. */
export type FileFacts = {
  readonly version: typeof FILE_FACTS_VERSION;
  /** Syntax tree nodes the walk visited: how much code the facts rest on. */
  readonly nodes: number;
  readonly typeSafety: TypeSafetyFacts;
  readonly modules: ModuleFacts;
  readonly idioms: IdiomFacts;
  readonly ecosystem: EcosystemFacts;
  readonly functions: FunctionFacts;
  readonly tests: TestFacts;
  readonly markers: MarkerFacts;
};

/** Whether a value that crossed a process boundary is the facts of the current version. */
export const isFileFacts = (value: unknown): value is FileFacts =>
  typeof value === "object" &&
  value !== null &&
  "version" in value &&
  value.version === FILE_FACTS_VERSION;

/**
 * The facts of one parsed file, from a single walk over its program; `text`
 * is the source the parse read, for the facts that need lines. Pure over the
 * parse and synchronous. Throws a `RangeError` where the tree is nested
 * deeper than the stack allows.
 */
export const fileFactsOf = (parsed: ParsedSource, text: string): FileFacts => {
  let nodes = 0;
  const typeSafety = typeSafetyCollector();
  const modules = moduleCollector();
  const idioms = idiomCollector();
  const ecosystem = ecosystemCollector();
  const functions = functionCollector(text);
  const tests = testCollector();
  const collectors = [typeSafety, modules, idioms, ecosystem, functions, tests];
  walk(parsed.program, {
    enter: (node) => {
      nodes += 1;
      for (const collector of collectors) {
        collector.enter(node);
      }
    },
    leave: (node) => {
      for (const collector of collectors) {
        collector.leave?.(node);
      }
    },
  });
  return {
    version: FILE_FACTS_VERSION,
    nodes,
    typeSafety: typeSafety.finish(parsed),
    modules: modules.finish(parsed),
    idioms: idioms.finish(parsed),
    ecosystem: ecosystem.finish(parsed),
    functions: functions.finish(parsed),
    tests: tests.finish(parsed),
    markers: markersOf(parsed, text),
  };
};
