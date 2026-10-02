// Owns what only the repository's own stats carry beyond a territory's: the histograms and a longer list of the most changed files.
// A territory card has no room for them and every territory would repeat them in the JSON.

import type { CodeStats } from "../report/code-stats.js";
import type { InventoryFile } from "../universe/inventory.js";
import { churnHistogram, mostChangedFiles } from "./churn.js";
import { byPath } from "./code-stats.js";
import { complexityHistogram } from "./complexity.js";
import { fileLengthHistogram } from "./file-length.js";

/** The most changed files of the repository. */
const REPOSITORY_TOP_FILES = 5;

/**
 * `stats` of the universe `files`, with the histograms and the repository's
 * five most changed files added.
 */
export const withRepositoryDetail = (
  stats: CodeStats,
  files: ReadonlyArray<InventoryFile>,
  revisions: ReadonlyMap<string, number>,
): CodeStats => {
  const sorted = files.toSorted(byPath);
  return {
    ...stats,
    fileLength: { ...stats.fileLength, histogram: fileLengthHistogram(sorted) },
    churn: {
      ...stats.churn,
      histogram: churnHistogram(sorted, revisions),
      mostChanged: mostChangedFiles(sorted, revisions, REPOSITORY_TOP_FILES),
    },
    complexity: { ...stats.complexity, histogram: complexityHistogram(sorted) },
  };
};
