// Owns reading the code stats into the facts the code badges compare: a territory's own, and those of the siblings it is compared with.
// Types only come from `territory-badge-facts.ts`; this is the one place that knows the stats' shape.

import type { MeasuredTerritory } from "../knowledge/territories.js";
import type { CodeStats } from "../report/code-stats.js";
import type { CodeFacts, SiblingFacts } from "./territory-badge-facts.js";

/** The code stats the code badges compare, from the report's stats. */
export const codeFactsOf = (stats: CodeStats): CodeFacts => ({
  files: stats.files,
  codeLines: stats.codeLines,
  medianFileLines: stats.fileLength.median,
  medianRevisions: stats.churn.median,
  revisionLines: stats.churn.revisionLines,
  complexityPerLine: stats.complexity.perLine,
});

/** The median of `values`, halfway between the two middle ones for an even number; 0 for none. */
const medianOf = (values: ReadonlyArray<number>): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/** The named territories among `siblings` and what they hold together. */
export const siblingFactsOf = (
  siblings: ReadonlyArray<MeasuredTerritory>,
): SiblingFacts => {
  const named = siblings.filter(({ kind }) => kind !== "other");
  return {
    count: named.length,
    codeLines: named.reduce((sum, { stats }) => sum + stats.codeLines, 0),
    revisionLines: named.reduce(
      (sum, { stats }) => sum + stats.churn.revisionLines,
      0,
    ),
    medianRevisions: medianOf(named.map(({ stats }) => stats.churn.median)),
    complexityPerLine: medianOf(
      named.map(({ stats }) => stats.complexity.perLine),
    ),
  };
};
