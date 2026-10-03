// Owns turning the test facts of the parsed test files into the report's `tests` block.

import type { Ecosystem } from "../../report/typescript-ecosystem.js";
import type { Tests } from "../../report/typescript-tests.js";
import { sum, sumColumns } from "../../stats/measures.js";
import { isTestPath } from "../../universe/path-kinds.js";
import type { ParsedFile } from "../parsed-file.js";
import { ASSERTION_EDGES } from "./test-facts.js";
import type { TestFacts } from "./test-facts.js";

const MAX_FOCUSED_FILES = 5;

/** The tests of the test files among `files`; the frameworks are those the ecosystem detected. */
export const testsOf = (
  files: ReadonlyArray<ParsedFile>,
  ecosystem: Ecosystem,
): Tests => {
  const testFiles = files.filter(({ path }) => isTestPath(path));
  const total = (count: (facts: TestFacts) => number): number =>
    sum(testFiles.map(({ facts }) => count(facts.tests)));
  const focusedPaths = testFiles
    .filter(({ facts }) => facts.tests.focused > 0)
    .map(({ path }) => path)
    .toSorted();
  return {
    files: testFiles.length,
    frameworks: ecosystem.tools
      .filter(({ category }) => category === "test")
      .map(({ name }) => name),
    cases: total((tests) => tests.cases),
    parameterized: total((tests) => tests.parameterized),
    skipped: total((tests) => tests.skipped),
    focused: total((tests) => tests.focused),
    todo: total((tests) => tests.todo),
    focusedFiles: focusedPaths.slice(0, MAX_FOCUSED_FILES),
    focusedFileCount: focusedPaths.length,
    assertions: sumColumns(
      testFiles.map(({ facts }) => facts.tests.assertions),
      ASSERTION_EDGES.length + 1,
    ),
    snapshots: total((tests) => tests.snapshots),
    typeTests: total((tests) => tests.typeTests),
  };
};
