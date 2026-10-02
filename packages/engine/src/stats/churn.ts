// Owns the churn stats: how often the files of a set changed.

import type { CodeStats } from "../report/code-stats.js";
import { roundReported } from "../report/precision.js";
import type { InventoryFile } from "../universe/inventory.js";
import { percentiles, tallyOf } from "./distribution.js";
import { histogram } from "./histogram.js";
import { sum } from "./measures.js";

/** Where the buckets "1", "2", "3–4", "5–9", "10–19" and "20+" revisions start after the first. */
const BUCKET_EDGES = [2, 3, 5, 10, 20];

/** The most changed files a territory lists. */
const TERRITORY_TOP_FILES = 3;

type CountedFile = {
  readonly path: string;
  readonly loc: number;
  readonly revisions: number;
};

/** The files with their revisions; a file `revisions` lacks has been committed once at least. */
const countedOf = (
  files: ReadonlyArray<InventoryFile>,
  revisions: ReadonlyMap<string, number>,
): ReadonlyArray<CountedFile> =>
  files.map((file) => ({
    path: file.path,
    loc: file.loc,
    revisions: revisions.get(file.path) ?? 1,
  }));

/** The files with the most revisions, most first; ties keep the order of `files`. */
const topFiles = (
  files: ReadonlyArray<CountedFile>,
  limit: number,
): CodeStats["churn"]["mostChanged"] => {
  const top: Array<{ path: string; revisions: number }> = [];
  for (const { path, revisions } of files) {
    const place = top.findIndex((file) => revisions > file.revisions);
    if (place !== -1) {
      top.splice(place, 0, { path, revisions });
    } else if (top.length < limit) {
      top.push({ path, revisions });
    }
    top.length = Math.min(top.length, limit);
  }
  return top;
};

/** The `limit` files with the most revisions, most first; `files` must be sorted by path, which breaks ties. */
export const mostChangedFiles = (
  files: ReadonlyArray<InventoryFile>,
  revisions: ReadonlyMap<string, number>,
  limit: number,
): CodeStats["churn"]["mostChanged"] =>
  topFiles(countedOf(files, revisions), limit);

/** The files of `files` counted into the revision buckets. */
export const churnHistogram = (
  files: ReadonlyArray<InventoryFile>,
  revisions: ReadonlyMap<string, number>,
): ReadonlyArray<number> =>
  histogram(
    countedOf(files, revisions).map((file) => file.revisions),
    BUCKET_EDGES,
  );

/**
 * The churn stats of `files`, sorted by path, without the histogram and with a
 * territory's few most changed files. `revisions` holds the revisions of each
 * path; a tracked file it lacks has been committed once at least.
 */
export const churnStats = (
  files: ReadonlyArray<InventoryFile>,
  revisions: ReadonlyMap<string, number>,
): CodeStats["churn"] => {
  const counted = countedOf(files, revisions);
  const perFile = counted.map((file) => file.revisions);
  const [median = 0, p90 = 0] = percentiles(tallyOf(perFile), [0.5, 0.9]);
  return {
    median: roundReported(median),
    p90: roundReported(p90),
    revisions: sum(perFile),
    revisionLines: sum(counted.map((file) => file.revisions * file.loc)),
    mostChanged: topFiles(counted, TERRITORY_TOP_FILES),
  };
};
