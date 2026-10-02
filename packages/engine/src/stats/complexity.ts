// Owns the complexity stats: indentation levels per line, after codeheat's complexity metric.

import type { CodeStats } from "../report/code-stats.js";
import { roundReported } from "../report/precision.js";
import type { InventoryFile } from "../universe/inventory.js";
import { percentile, tallyOf } from "./distribution.js";
import { histogram } from "./histogram.js";
import { highestBy, ratioOf, sum } from "./measures.js";

const BUCKETS = [
  { label: "<0.25", below: 0.25 },
  { label: "0.25–0.5", below: 0.5 },
  { label: "0.5–1", below: 1 },
  { label: "1–1.5", below: 1.5 },
  { label: "1.5–2", below: 2 },
  { label: "2+", below: Infinity },
];

/** The levels per non-blank line of one file. */
const perLineOf = ({ levels, loc }: InventoryFile): number =>
  loc === 0 ? 0 : levels / loc;

/** The complexity stats of `files`, sorted by path; files without a code line are left out of the per-file figures. */
export const complexityStats = (
  files: ReadonlyArray<InventoryFile>,
): CodeStats["complexity"] => {
  const withCode = files.filter(({ loc }) => loc > 0);
  const perFile = withCode.map((file) => perLineOf(file));
  const deepest = highestBy(withCode, perLineOf);
  return {
    perLine: ratioOf(
      sum(files.map(({ levels }) => levels)),
      sum(files.map(({ loc }) => loc)),
    ),
    medianFile: roundReported(percentile(tallyOf(perFile), 0.5)),
    deepestLevel: files.reduce(
      (deepestLevel, file) => Math.max(deepestLevel, file.deepestLevel),
      0,
    ),
    histogram: histogram(perFile, BUCKETS),
    deepestFile:
      deepest === undefined
        ? null
        : { path: deepest.path, perLine: roundReported(perLineOf(deepest)) },
  };
};
