// Owns finding the runs of consecutive days in a set of day numbers, which streaks and achievements read.
// Days are numbers as `localDayOf` makes them; one sort, one pass.

/** A run of consecutive days: the first day and how many there are. */
export type DayRun = { readonly start: number; readonly length: number };

/** The runs of consecutive days among `days`, oldest first; a repeated day counts once. */
export const dayRuns = (days: Iterable<number>): ReadonlyArray<DayRun> => {
  const runs: Array<DayRun> = [];
  for (const day of [...new Set(days)].toSorted((a, b) => a - b)) {
    const last = runs.at(-1);
    if (last !== undefined && day === last.start + last.length) {
      runs[runs.length - 1] = { start: last.start, length: last.length + 1 };
    } else {
      runs.push({ start: day, length: 1 });
    }
  }
  return runs;
};
