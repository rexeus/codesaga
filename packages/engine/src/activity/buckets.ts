// Owns the time buckets of the report: weeks that start on Monday and calendar months, both in UTC.
// Activity and automation share them so their months line up.
// Buckets cover a window without gaps; a window of years yields a few hundred entries.

import type { TimeRange } from "../analyze/analysis-window.js";

/**
 * The `YYYY-MM-DD` of the Monday (UTC) of the week containing `time`, given in
 * seconds since the epoch.
 */
export const weekStartOf = (_time: number): string => {
  throw new Error("@scaffold not implemented");
};

/**
 * The `YYYY-MM` (UTC) of the month containing `time`, given in seconds since
 * the epoch.
 */
export const monthOf = (_time: number): string => {
  throw new Error("@scaffold not implemented");
};

/**
 * Every week start from the week containing `window.since` through the week
 * containing `window.until`, oldest first, without gaps.
 */
export const weeksOf = (_window: TimeRange): ReadonlyArray<string> => {
  throw new Error("@scaffold not implemented");
};

/**
 * Every month from the month containing `window.since` through the month
 * containing `window.until`, oldest first, without gaps.
 */
export const monthsOf = (_window: TimeRange): ReadonlyArray<string> => {
  throw new Error("@scaffold not implemented");
};
