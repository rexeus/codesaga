// Owns counting values into the fixed buckets of the report's histograms.

/**
 * Counts `values` into one more bucket than there are `edges`, in ascending
 * order: the first bucket takes the values below `edges[0]`, each next one
 * those from its own edge up to the next, and the last everything from the
 * last edge on, so no value is dropped. `edges` must ascend.
 */
export const histogram = (
  values: ReadonlyArray<number>,
  edges: ReadonlyArray<number>,
): ReadonlyArray<number> => {
  const counts = [...edges, Infinity].map(() => 0);
  for (const value of values) {
    const found = edges.findIndex((edge) => value < edge);
    const slot = found === -1 ? edges.length : found;
    counts[slot] = (counts[slot] ?? 0) + 1;
  }
  return counts;
};
