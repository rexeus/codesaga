// Tests only: the digest of a source next to what the full facts of the same source say, for suites that hold the digest walk's skips to the walk of every collector over every node.
import {
  digestOfSource,
  factsOfSource,
} from "../typescript/facts-of-source.js";
import type { FileFacts } from "../typescript/file-facts.js";
import { oxcParse } from "./oxc-parser.js";

/** What a digest holds that the full facts of the same file hold too, computed from those facts alone: the walk of every collector over every node. */
const sharedWith = (facts: FileFacts, text: string) => {
  const { typeSafety, modules, functions, tests } = facts;
  const suppressions =
    typeSafety.tsIgnore +
    typeSafety.tsExpectError +
    typeSafety.tsNocheck +
    typeSafety.lintDisables;
  return {
    lines: text.split("\n").filter((line) => line.trim() !== "").length,
    any: typeSafety.any,
    escapes:
      typeSafety.anyOutsideAssertions +
      typeSafety.assertionChains +
      typeSafety.nonNull +
      suppressions,
    suppressions,
    functions: functions.count,
    complexFunctions:
      (functions.complexity[3] ?? 0) + (functions.complexity[4] ?? 0),
    notable: functions.notable.map(({ name, complexity }) => [
      name,
      complexity,
    ]),
    esm: modules.esm > 0,
    commonjs: modules.commonjs > 0,
    testCases: tests.cases,
    focusedTests: tests.focused,
  };
};

/** The shared part of the digest and of the facts of one source, or the reason either was not made. */
export const bothOf = (path: string, text: string) => {
  const digest = digestOfSource(oxcParse, { path, text });
  const facts = factsOfSource(oxcParse, { path, text });
  if (digest.kind !== "parsed" || facts.kind !== "parsed") {
    return undefined;
  }
  const { facts: counted } = digest;
  return {
    digest: {
      lines: counted.lines,
      any: counted.any,
      escapes: counted.escapes,
      suppressions: counted.suppressions,
      functions: counted.functions,
      complexFunctions: counted.complexFunctions,
      notable: counted.notable,
      esm: counted.esm,
      commonjs: counted.commonjs,
      testCases: counted.testCases,
      focusedTests: counted.focusedTests,
    },
    facts: sharedWith(facts.facts, text),
  };
};
