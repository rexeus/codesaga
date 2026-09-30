// Owns the punch card: commits per weekday and hour in the author's local time.
// Local time, not UTC, because "people commit at 23:00" is about their day.
// The result is always 7 x 24 numbers, whatever the history's size.

import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { groupBy } from "../collections/group-by.js";
import type { Report } from "../report/report.js";
import { localDayOf, localHourOf, weekdayOfDay } from "./buckets.js";

const WEEKDAYS = 7;
const HOURS = 24;

/**
 * The `punchcard` section: row 0 is Monday, column 0 is hour 0. A commit at
 * `23:30+02:00` counts for its local weekday and hour 23. Only human and
 * agent-assisted commits count: the card describes people's rhythm, and a
 * bot's schedule would distort it.
 */
export const punchcard = (
  commits: ReadonlyArray<ClassifiedCommit>,
): Report["punchcard"] => {
  const cells = groupBy(
    commits.filter((commit) => isContributorCommit(commit)),
    ({ time, offsetMinutes }) =>
      weekdayOfDay(localDayOf(time, offsetMinutes)) * HOURS +
      localHourOf(time, offsetMinutes),
  );
  return Array.from({ length: WEEKDAYS }, (_row, weekday) =>
    Array.from(
      { length: HOURS },
      (_cell, hour) => cells.get(weekday * HOURS + hour)?.length ?? 0,
    ),
  );
};
