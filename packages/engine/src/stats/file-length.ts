// Owns the file length stats: how many lines the files have, their spread and the longest of them.

import type { CodeStats } from "../report/code-stats.js";
import { roundReported } from "../report/precision.js";
import type { InventoryFile } from "../universe/inventory.js";
import { percentile, tallyOf } from "./distribution.js";
import { histogram } from "./histogram.js";
import { highestBy } from "./measures.js";

const BUCKETS = [
  { label: "1–50", below: 51 },
  { label: "51–100", below: 101 },
  { label: "101–200", below: 201 },
  { label: "201–400", below: 401 },
  { label: "401–800", below: 801 },
  { label: "800+", below: Infinity },
];

/** The file length stats of `files`, sorted by path; files without a code line are left out. */
export const fileLengthStats = (
  files: ReadonlyArray<InventoryFile>,
): CodeStats["fileLength"] => {
  const withCode = files.filter(({ loc }) => loc > 0);
  const lengths = withCode.map(({ loc }) => loc);
  const lengthTally = tallyOf(lengths);
  return {
    min: lengths.reduce(
      (min, length) => Math.min(min, length),
      lengths[0] ?? 0,
    ),
    median: roundReported(percentile(lengthTally, 0.5)),
    max: lengths.reduce((max, length) => Math.max(max, length), 0),
    histogram: histogram(lengths, BUCKETS),
    longestFile: highestBy(withCode, ({ loc }) => loc)?.path ?? null,
  };
};
