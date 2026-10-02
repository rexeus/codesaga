// Owns joining complexity to change: how many of the revisions landed in files whose hardest function is hard, and which files are in the top decile of both.
// A file's complexity is its hardest function's, so a long file of easy functions is not inflated. One line on purpose: codeheat owns hotspots.

import type { ComplexityAndChange } from "../../report/typescript-functions.js";
import { percentile, tallyOf } from "../../stats/distribution.js";
import { ratioOf, sum } from "../../stats/measures.js";
import { isTestPath } from "../../universe/path-kinds.js";
import type { ParsedFile } from "../parsed-file.js";
import {
  COMPLEXITY_LIMIT,
  HOTSPOT_MIN_COMPLEXITY,
  HOTSPOT_MIN_REVISIONS,
  HOTSPOT_QUANTILE,
  MAX_HOTSPOTS,
} from "./function-thresholds.js";

type Row = {
  readonly path: string;
  readonly complexity: number;
  readonly revisions: number;
};

const hardestOf = ({ facts }: ParsedFile): number =>
  facts.functions.scores.reduce(
    (highest, [score]) => Math.max(highest, score),
    0,
  );

const byRevisionsThenHardnessThenPath = (left: Row, right: Row): number =>
  right.revisions - left.revisions ||
  right.complexity - left.complexity ||
  Number(left.path > right.path) - Number(left.path < right.path);

/**
 * The join of the production files' hardest functions with their revisions,
 * `revisions` being the commits per path in its current life, and `shallow`
 * whether the history is a shallow clone, which the block says. Undefined when
 * no production file holds a function.
 */
export const complexityAndChangeOf = (
  files: ReadonlyArray<ParsedFile>,
  revisions: ReadonlyMap<string, number>,
  shallow: boolean,
): ComplexityAndChange | undefined => {
  const rows: ReadonlyArray<Row> = files
    .filter(({ path, facts }) => !isTestPath(path) && facts.functions.count > 0)
    .map((file) => ({
      path: file.path,
      complexity: hardestOf(file),
      revisions: revisions.get(file.path) ?? 0,
    }));
  if (rows.length === 0) {
    return undefined;
  }
  const complex = rows.filter(
    ({ complexity }) => complexity >= COMPLEXITY_LIMIT,
  );
  const complexRevisions = sum(complex.map((row) => row.revisions));
  const totalRevisions = sum(rows.map((row) => row.revisions));
  const hardnessFloor = percentile(
    tallyOf(rows.map((row) => row.complexity)),
    HOTSPOT_QUANTILE,
  );
  const revisionFloor = percentile(
    tallyOf(rows.map((row) => row.revisions)),
    HOTSPOT_QUANTILE,
  );
  return {
    ...(shallow ? { shallow: true as const } : {}),
    files: rows.length,
    revisions: totalRevisions,
    complexFiles: complex.length,
    complexRevisions,
    complexRevisionShare: ratioOf(complexRevisions, totalRevisions),
    hotspots: rows
      .filter(
        (row) =>
          row.complexity >= Math.max(hardnessFloor, HOTSPOT_MIN_COMPLEXITY) &&
          row.revisions >= Math.max(revisionFloor, HOTSPOT_MIN_REVISIONS),
      )
      .toSorted(byRevisionsThenHardnessThenPath)
      .slice(0, MAX_HOTSPOTS),
  };
};
