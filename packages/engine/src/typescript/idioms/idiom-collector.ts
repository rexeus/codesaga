// Owns counting the idioms of one file: one walk for the nodes anywhere, and one look at the top-level statements.

import type { Statement } from "@oxc-project/types";

import { declarationOf } from "../node-guards.js";
import type { FactsCollector, ParsedSource } from "../parsed-source.js";
import { onNodes } from "../walk.js";
import { noIdioms } from "./idiom-facts.js";
import type { IdiomCounts, IdiomFacts } from "./idiom-facts.js";
import {
  bindingHandlers,
  declarationHandlers,
  expressionHandlers,
} from "./idiom-handlers.js";
import { exportedNames } from "./idiom-syntax.js";

const isFunctionValue = (type: string | undefined): boolean =>
  type === "ArrowFunctionExpression" || type === "FunctionExpression";

/**
 * Counts what a top-level statement exports. Only top-level statements are
 * read, so the `export` of a member of a `namespace` is not an export of the
 * module.
 */
const countExports = (statement: Statement, counts: IdiomCounts): void => {
  if (statement.type === "ExportDefaultDeclaration") {
    counts.defaultExports += 1;
  } else if (statement.type === "ExportNamedDeclaration") {
    counts.namedExports += exportedNames(statement);
    counts.defaultExports += statement.specifiers.filter(
      ({ exported }) =>
        exported.type === "Identifier" && exported.name === "default",
    ).length;
  }
};

/** Counts the classes, functions and arrow constants declared at the top of the file's program. */
const countTopLevel = (
  { program }: ParsedSource,
  counts: IdiomCounts,
): void => {
  for (const statement of program.body) {
    countExports(statement, counts);
    const declaration = declarationOf(statement);
    if (declaration?.type === "ClassDeclaration") {
      counts.classes += 1;
    } else if (declaration?.type === "FunctionDeclaration") {
      counts.functions += 1;
    } else if (declaration?.type === "VariableDeclaration") {
      counts.arrowConsts +=
        declaration.kind === "const"
          ? declaration.declarations.filter(({ init }) =>
              isFunctionValue(init?.type),
            ).length
          : 0;
    }
  }
};

/** Counts idiom facts over one walk and the file's top-level statements. */
export const idiomCollector = (): FactsCollector<IdiomFacts> => {
  const counts = noIdioms();
  return {
    enter: onNodes({
      ...declarationHandlers(counts),
      ...bindingHandlers(counts),
      ...expressionHandlers(counts),
    }),
    finish: (parsed) => {
      countTopLevel(parsed, counts);
      return counts;
    },
  };
};
