// Owns the file length stats: how many lines the files have, their spread and the longest of them.

import type { CodeStats } from "../report/code-stats.js";
import { roundReported } from "../report/precision.js";
import type { InventoryFile } from "../universe/inventory.js";
import { percentile, tallyOf } from "./distribution.js";
import { histogram } from "./histogram.js";
import { highestBy } from "./measures.js";

/** Where the buckets "1–50", "51–100", "101–200", "201–400", "401–800" and "> 800" start after the first. */
const BUCKET_EDGES = [51, 101, 201, 401, 801];

const lengthsOf = (files: ReadonlyArray<InventoryFile>): Array<number> =>
  files.filter(({ loc }) => loc > 0).map(({ loc }) => loc);

/** The files of `files` that have a code line, counted into the file length buckets. */
export const fileLengthHistogram = (
  files: ReadonlyArray<InventoryFile>,
): ReadonlyArray<number> => histogram(lengthsOf(files), BUCKET_EDGES);

/** The file length stats of `files`, sorted by path, without the histogram; files without a code line are left out. */
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
    longestFile: highestBy(withCode, ({ loc }) => loc)?.path ?? null,
  };
};
