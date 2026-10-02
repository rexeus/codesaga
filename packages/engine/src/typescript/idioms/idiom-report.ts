// Owns turning the idiom facts of the production files into the report's block.

import type { Idioms } from "../../report/typescript-idioms.js";
import { sum } from "../../stats/measures.js";
import { isTestPath } from "../../universe/path-kinds.js";
import type { ParsedFile } from "../parsed-file.js";
import type { IdiomFacts } from "./idiom-facts.js";

/** The sum of one count over the files. */
const total =
  (files: ReadonlyArray<ParsedFile>) =>
  (count: (idioms: IdiomFacts) => number): number =>
    sum(files.map(({ facts }) => count(facts.idioms)));

/** The idioms of the files that are not tests. */
export const idiomsOf = (files: ReadonlyArray<ParsedFile>): Idioms => {
  const production = files.filter(({ path }) => !isTestPath(path));
  const sumOf = total(production);
  return {
    files: production.length,
    declarations: {
      interfaces: sumOf((i) => i.interfaces),
      objectTypes: sumOf((i) => i.objectTypes),
    },
    enums: {
      enums: sumOf((i) => i.enums),
      stringUnions: sumOf((i) => i.stringUnions),
    },
    topLevel: {
      classes: sumOf((i) => i.classes),
      functions: sumOf((i) => i.functions),
      arrowConsts: sumOf((i) => i.arrowConsts),
    },
    async: {
      awaits: sumOf((i) => i.awaits),
      thenCalls: sumOf((i) => i.thenCalls),
    },
    privacy: {
      hashPrivate: sumOf((i) => i.hashPrivate),
      privateModifiers: sumOf((i) => i.privateModifiers),
    },
    exports: {
      defaultExports: sumOf((i) => i.defaultExports),
      namedExports: sumOf((i) => i.namedExports),
    },
    bindings: {
      consts: sumOf((i) => i.consts),
      lets: sumOf((i) => i.lets),
      vars: sumOf((i) => i.vars),
    },
    iteration: {
      forOf: sumOf((i) => i.forOf),
      forEachCalls: sumOf((i) => i.forEachCalls),
    },
    mutation: {
      mutationCalls: sumOf((i) => i.mutationCalls),
      transformCalls: sumOf((i) => i.transformCalls),
      spreads: sumOf((i) => i.spreads),
    },
    nullish: {
      optionalChains: sumOf((i) => i.optionalChains),
      nullishCoalescing: sumOf((i) => i.nullishCoalescing),
    },
  };
};
