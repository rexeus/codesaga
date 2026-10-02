// Owns summarizing numbers by counting how often each value occurs.
// Line lengths and file sizes repeat a lot, so a tally merges across files and territories without keeping every value.

import { sum } from "./measures.js";

/** How many times each value occurs. */
export type Tally = ReadonlyMap<number, number>;

/** The tally of `values`. */
export const tallyOf = (values: Iterable<number>): Tally => {
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
};

/**
 * The tally that adds up `tallies` of non-negative integers, such as line
 * lengths. Adding into a dense array first is much cheaper than merging maps,
 * and a territory merges every file it holds.
 */
export const mergeIntegerTallies = (tallies: ReadonlyArray<Tally>): Tally => {
  let largest = 0;
  for (const tally of tallies) {
    for (const value of tally.keys()) {
      largest = Math.max(largest, value);
    }
  }
  const dense = new Float64Array(largest + 1);
  for (const tally of tallies) {
    for (const [value, count] of tally) {
      dense[value] = (dense[value] ?? 0) + count;
    }
  }
  const merged = new Map<number, number>();
  for (let value = 0; value <= largest; value++) {
    const count = dense[value] ?? 0;
    if (count > 0) {
      merged.set(value, count);
    }
  }
  return merged;
};

/**
 * The `ps` quantiles (each 0 to 1) of the tallied values, interpolating
 * linearly between the two closest ranks, so the median of an even count is
 * the mean of the two middle values. All 0 for an empty tally.
 */
export const percentiles = (
  tally: Tally,
  ps: ReadonlyArray<number>,
): ReadonlyArray<number> => {
  const values = Float64Array.from(tally.keys()).toSorted();
  const total = sum(tally.values());
  const rankStarts = new Float64Array(values.length);
  let seen = 0;
  for (const [index, value] of values.entries()) {
    rankStarts[index] = seen;
    seen += tally.get(value) ?? 0;
  }
  /** The value at `rank` (0 is the smallest): the last value whose first rank is not above it. */
  const valueAtRank = (rank: number): number => {
    let low = 0;
    let high = values.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((rankStarts[middle] ?? 0) <= rank) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return values[low] ?? 0;
  };
  return ps.map((p) => {
    if (total === 0) {
      return 0;
    }
    const rank = (total - 1) * p;
    const below = Math.floor(rank);
    const lower = valueAtRank(below);
    const upper = valueAtRank(Math.ceil(rank));
    return lower + (upper - lower) * (rank - below);
  });
};

/** The `p` quantile of the tallied values; see `percentiles`. */
export const percentile = (tally: Tally, p: number): number =>
  percentiles(tally, [p])[0] ?? 0;
