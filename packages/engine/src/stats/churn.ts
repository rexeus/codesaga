// Owns the churn stats: how often the files of a set changed.

import type { CodeStats } from "../report/code-stats.js";
import { roundReported } from "../report/precision.js";
import type { InventoryFile } from "../universe/inventory.js";
import { percentiles, tallyOf } from "./distribution.js";
import { histogram } from "./histogram.js";
import { sum } from "./measures.js";

const BUCKETS = [
  { label: "1", below: 2 },
  { label: "2", below: 3 },
  { label: "3–4", below: 5 },
  { label: "5–9", below: 10 },
  { label: "10–19", below: 20 },
  { label: "20+", below: Infinity },
];

const TOP_FILES = 5;

/** The files with the most revisions, most first; ties keep the order of `files`. */
const topFiles = (
  files: ReadonlyArray<{ readonly path: string; readonly revisions: number }>,
): CodeStats["churn"]["mostChanged"] => {
  const top: Array<{ path: string; revisions: number }> = [];
  for (const { path, revisions } of files) {
    const place = top.findIndex((file) => revisions > file.revisions);
    if (place !== -1) {
      top.splice(place, 0, { path, revisions });
    } else if (top.length < TOP_FILES) {
      top.push({ path, revisions });
    }
    top.length = Math.min(top.length, TOP_FILES);
  }
  return top;
};

/**
 * The churn stats of `files`, sorted by path. `revisions` holds the revisions
 * of each path; a tracked file it lacks has been committed once at least.
 */
export const churnStats = (
  files: ReadonlyArray<InventoryFile>,
  revisions: ReadonlyMap<string, number>,
): CodeStats["churn"] => {
  const counted = files.map((file) => ({
    path: file.path,
    loc: file.loc,
    revisions: revisions.get(file.path) ?? 1,
  }));
  const perFile = counted.map((file) => file.revisions);
  const [median = 0, p90 = 0] = percentiles(tallyOf(perFile), [0.5, 0.9]);
  return {
    median: roundReported(median),
    p90: roundReported(p90),
    revisions: sum(perFile),
    revisionLines: sum(counted.map((file) => file.revisions * file.loc)),
    histogram: histogram(perFile, BUCKETS),
    mostChanged: topFiles(counted),
  };
};
