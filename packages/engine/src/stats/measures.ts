// Owns the small arithmetic the stats share: rounding, shares and the file picked by a measure.

import { roundReported } from "../report/precision.js";

/** `part` divided by `whole`, rounded as reported values are; 0 when there is no whole. */
export const ratioOf = (part: number, whole: number): number =>
  whole === 0 ? 0 : roundReported(part / whole);

/** The sum of `values`. */
export const sum = (values: Iterable<number>): number => {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
};

/** The column sums of `rows`, each of `width` counts: the bucket counts of many sets added up. */
export const sumColumns = (
  rows: ReadonlyArray<ReadonlyArray<number>>,
  width: number,
): ReadonlyArray<number> =>
  Array.from({ length: width }, (_, column) =>
    sum(rows.map((row) => row[column] ?? 0)),
  );

/**
 * The item with the highest `measure`; on a tie the earliest, so callers that
 * sort their items by path get the first path. Undefined for no items.
 */
export const highestBy = <A>(
  items: ReadonlyArray<A>,
  measure: (item: A) => number,
): A | undefined =>
  items.reduce<A | undefined>(
    (best, item) =>
      best === undefined || measure(item) > measure(best) ? item : best,
    undefined,
  );
