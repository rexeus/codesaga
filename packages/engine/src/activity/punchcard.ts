// Owns the punch card: commits per weekday and hour in the author's local time.
// Local time, not UTC, because "people commit at 23:00" is about their day.
// The result is always 7 x 24 numbers, whatever the history's size.

import type { ClassifiedCommit } from "../automation/classify.js";
import type { Report } from "../report/report.js";

/**
 * The `punchcard` section: row 0 is Monday, column 0 is hour 0. A commit at
 * `23:30+02:00` counts for its local weekday and hour 23.
 */
export const punchcard = (
  _commits: ReadonlyArray<ClassifiedCommit>,
): Report["punchcard"] => {
  throw new Error("@scaffold not implemented");
};
