// Owns the code stats of a set of files: size, languages, tests, churn, complexity and style.
// A pure function of the files and their revisions, so it serves the repository and any territory alike
// and knows nothing about how territories are cut.

import { Order } from "effect";

import type { CodeStats } from "../report/code-stats.js";
import type { InventoryFile } from "../universe/inventory.js";
import { languageBreakdown } from "../universe/languages.js";
import { isTestPath } from "../universe/path-kinds.js";
import { churnStats } from "./churn.js";
import { complexityStats } from "./complexity.js";
import { fileLengthStats } from "./file-length.js";
import { sum } from "./measures.js";
import { styleStats } from "./style.js";

const byPath = Order.mapInput(Order.String, (file: InventoryFile) => file.path);

/**
 * The stats of `files`, a set of universe files at HEAD, with the `revisions`
 * of their paths from `revisionsOf`. Ties between files break by path.
 * The commit habits of `style` are the repository's own; see `universeStats`.
 */
export const codeStats = (
  files: ReadonlyArray<InventoryFile>,
  revisions: ReadonlyMap<string, number>,
): CodeStats => {
  const sorted = files.toSorted(byPath);
  const codeLines = sum(sorted.map(({ loc }) => loc));
  const tests = sorted.filter(({ path }) => isTestPath(path));
  return {
    files: sorted.length,
    codeLines,
    fileLength: fileLengthStats(sorted),
    languages: languageBreakdown(sorted).map(({ name, files: count, loc }) => ({
      name,
      files: count,
      lines: loc,
    })),
    tests: { files: tests.length, lines: sum(tests.map(({ loc }) => loc)) },
    churn: churnStats(sorted, revisions),
    complexity: complexityStats(sorted),
    style: styleStats(sorted, codeLines),
  };
};
