// Owns counting files into labelled buckets, as the report's histograms do.

/** A bucket holds the values below `below` and at or above the previous bucket's `below`. */
export type Bucket = {
  readonly label: string;
  readonly below: number;
};

/** The report's histogram entry: a bucket's label and the number of files in it. */
export type Bin = {
  readonly label: string;
  readonly files: number;
};

/**
 * Counts `values` into `buckets`, which must ascend; the last bucket should
 * be unbounded (`below: Infinity`) so that no value is dropped.
 */
export const histogram = (
  values: ReadonlyArray<number>,
  buckets: ReadonlyArray<Bucket>,
): ReadonlyArray<Bin> => {
  const counts = buckets.map(() => 0);
  for (const value of values) {
    const found = buckets.findIndex(({ below }) => value < below);
    const slot = found === -1 ? counts.length - 1 : found;
    counts[slot] = (counts[slot] ?? 0) + 1;
  }
  return buckets.map(({ label }, index) => ({
    label,
    files: counts[index] ?? 0,
  }));
};
