// Owns computing the digest of one parsed file: one walk with the collectors the history reads, and a look at the top-level statements.
// The collectors that only HEAD needs (idioms, ecosystem, markers) do not run, which is most of the cost of a file's facts.
import type { Node } from "@oxc-project/types";

import { sum } from "../../stats/measures.js";
import { functionCollector } from "../functions/function-collector.js";
import { moduleCollector } from "../modules/module-facts.js";
import { declarationOf } from "../node-guards.js";
import type { ParsedSource } from "../parsed-source.js";
import { testCollector } from "../tests/test-facts.js";
import { nonBlankLineCount } from "../text-lines.js";
import { typeSafetyCollector } from "../type-safety/type-safety-facts.js";
import { escapesOf } from "../type-safety/type-safety-report.js";
import { walk } from "../walk.js";
import { FILE_DIGEST_VERSION } from "./file-digest.js";
import type { FileDigest } from "./file-digest.js";
import { kindOf } from "./type-nodes.js";

/** Functions in the last two complexity bands, 15 or more. */
const COMPLEX_BANDS = 2;

/** A text without the word `any` has no `any` keyword, and the type-safety facts of the digest are about no other keyword. */
const MENTIONS_ANY = /\bany\b/u;

const isFunctionValue = (type: string | undefined): boolean =>
  type === "ArrowFunctionExpression" || type === "FunctionExpression";

/** The classes, functions and arrow-function constants at the top of the program, and the functions among them that are exported where they are declared. */
const topLevelOf = ({
  program,
}: ParsedSource): { declarations: number; exportedFunctions: number } => {
  let declarations = 0;
  let exportedFunctions = 0;
  for (const statement of program.body) {
    const declaration = declarationOf(statement);
    const isExport =
      statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration";
    const functions =
      declaration?.type === "FunctionDeclaration" ||
      isFunctionValue(declaration?.type)
        ? 1
        : functionConstants(declaration);
    declarations +=
      functions + (declaration?.type === "ClassDeclaration" ? 1 : 0);
    exportedFunctions += isExport ? functions : 0;
  }
  return { declarations, exportedFunctions };
};

/** How many bindings of a `const` declaration hold an arrow function or a function expression. */
const functionConstants = (declaration: Node | null | undefined): number =>
  declaration?.type === "VariableDeclaration" && declaration.kind === "const"
    ? declaration.declarations.filter(({ init }) => isFunctionValue(init?.type))
        .length
    : 0;

/**
 * The digest of one parsed file; `text` is the source the parse read. Pure
 * over the parse and synchronous. Throws a `RangeError` where the tree is
 * nested deeper than the stack allows.
 */
export const fileDigestOf = (
  parsed: ParsedSource,
  text: string,
): FileDigest => {
  const typeSafety = typeSafetyCollector();
  const modules = moduleCollector();
  const functions = functionCollector(text);
  const tests = testCollector();
  const collectors = [typeSafety, modules, functions, tests];
  const hasAny = MENTIONS_ANY.test(text);
  walk(parsed.program, {
    enter: (node) => {
      const kind = kindOf(node);
      if (kind === "code") {
        for (const collector of collectors) {
          collector.enter(node);
        }
      } else if (kind === "type" && hasAny) {
        typeSafety.enter(node);
      }
    },
    leave: (node) => {
      const kind = kindOf(node);
      if (kind === "code") {
        for (const collector of collectors) {
          collector.leave?.(node);
        }
      } else if (kind === "type" && hasAny) {
        typeSafety.leave?.(node);
      }
    },
  });
  const safety = typeSafety.finish(parsed);
  const found = functions.finish(parsed);
  const moduleFacts = modules.finish(parsed);
  const testFacts = tests.finish(parsed);
  const topLevel = topLevelOf(parsed);
  return {
    version: FILE_DIGEST_VERSION,
    lines: nonBlankLineCount(text),
    any: safety.any,
    escapes: escapesOf(safety),
    suppressions: sum([
      safety.tsIgnore,
      safety.tsExpectError,
      safety.tsNocheck,
      safety.lintDisables,
    ]),
    functions: found.count,
    complexFunctions: sum(found.complexity.slice(-COMPLEX_BANDS)),
    notable: found.notable.map(({ name, complexity }) => [name, complexity]),
    esm: moduleFacts.esm > 0,
    commonjs: moduleFacts.commonjs > 0,
    testCases: testFacts.cases,
    focusedTests: testFacts.focused,
    declarations: topLevel.declarations,
    exportedFunctions: topLevel.exportedFunctions,
  };
};
