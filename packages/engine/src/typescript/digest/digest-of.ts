// Owns computing the digest of one parsed file: one walk with the collectors the history reads, and a look at the top-level statements.
// The collectors that only HEAD needs (idioms, ecosystem, markers) do not run, which is most of the cost of a file's facts.
import { sum } from "../../stats/measures.js";
import { functionCollector } from "../functions/function-collector.js";
import { exportsOf } from "../markers/export-docs.js";
import { moduleCollector } from "../modules/module-facts.js";
import { declarationOf } from "../node-guards.js";
import type { ParsedSource } from "../parsed-source.js";
import { testCollector } from "../tests/test-facts.js";
import { typeSafetyCollector } from "../type-safety/type-safety-facts.js";
import { escapesOf } from "../type-safety/type-safety-report.js";
import { walk } from "../walk.js";
import { FILE_DIGEST_VERSION } from "./file-digest.js";
import type { FileDigest } from "./file-digest.js";

/** Functions in the last two complexity bands, 15 or more. */
const COMPLEX_BANDS = 2;

const NON_BLANK = /\S/u;

/** Non-blank lines, which is what the universe's `loc` counts. */
const nonBlankLines = (text: string): number =>
  text.split("\n").filter((line) => NON_BLANK.test(line)).length;

const isFunctionValue = (type: string | undefined): boolean =>
  type === "ArrowFunctionExpression" || type === "FunctionExpression";

/** The classes, functions and arrow-function constants at the top of the program. */
const topLevelOf = ({
  program,
}: ParsedSource): { declarations: number; functions: number } => {
  let classes = 0;
  let functions = 0;
  for (const statement of program.body) {
    const declaration = declarationOf(statement);
    if (declaration?.type === "ClassDeclaration") {
      classes += 1;
    } else if (declaration?.type === "FunctionDeclaration") {
      functions += 1;
    } else if (
      declaration?.type === "VariableDeclaration" &&
      declaration.kind === "const"
    ) {
      functions += declaration.declarations.filter(({ init }) =>
        isFunctionValue(init?.type),
      ).length;
    }
  }
  return { declarations: classes + functions, functions };
};

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
  walk(parsed.program, {
    enter: (node) => {
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
  const safety = typeSafety.finish(parsed);
  const found = functions.finish(parsed);
  const moduleFacts = modules.finish(parsed);
  const testFacts = tests.finish(parsed);
  const topLevel = topLevelOf(parsed);
  return {
    version: FILE_DIGEST_VERSION,
    lines: nonBlankLines(text),
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
    topLevelFunctions: topLevel.functions,
    exportedDeclarations: exportsOf(parsed, text).exportedDeclarations,
  };
};
