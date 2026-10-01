// Owns the time buckets of the report: weeks that start on Monday and calendar months, both in UTC.
// Activity and automation share them so their months line up; the punch card reads local days and hours here.
// Buckets cover a window without gaps; a window of years yields a few hundred entries.

import { toEpochSeconds } from "../analyze/analysis-window.js";
import type { TimeRange } from "../analyze/analysis-window.js";

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3600;
const DAYS_PER_WEEK = 7;
/** 1970-01-01, day 0, was a Thursday: three days after Monday. */
const EPOCH_WEEKDAY = 3;

const positiveModulo = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor;

const isoDateOfDay = (day: number): string =>
  new Date(day * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10);

/**
 * The calendar day of a commit in the author's own time zone, as days since
 * 1970-01-01. `time` is in seconds since the epoch.
 */
export const localDayOf = (time: number, offsetMinutes: number): number =>
  Math.floor((time + offsetMinutes * 60) / SECONDS_PER_DAY);

/** The hour 0 to 23 of a commit in the author's own time zone. */
export const localHourOf = (time: number, offsetMinutes: number): number =>
  Math.floor(
    positiveModulo(time + offsetMinutes * 60, SECONDS_PER_DAY) /
      SECONDS_PER_HOUR,
  );

/** The weekday of a day number, 0 for Monday to 6 for Sunday. */
export const weekdayOfDay = (day: number): number =>
  positiveModulo(day + EPOCH_WEEKDAY, DAYS_PER_WEEK);

const mondayOfDay = (day: number): number => day - weekdayOfDay(day);

/**
 * The `YYYY-MM-DD` of the Monday (UTC) of the week containing `time`, given in
 * seconds since the epoch.
 */
export const weekStartOf = (time: number): string =>
  isoDateOfDay(mondayOfDay(localDayOf(time, 0)));

/**
 * The `YYYY-MM` (UTC) of the month containing `time`, given in seconds since
 * the epoch.
 */
export const monthOf = (time: number): string =>
  new Date(time * 1000).toISOString().slice(0, 7);

/**
 * Every week start from the week containing `window.since` through the week
 * containing `window.until`, oldest first, without gaps.
 */
export const weeksOf = (window: TimeRange): ReadonlyArray<string> => {
  const first = mondayOfDay(localDayOf(toEpochSeconds(window.since), 0));
  const last = mondayOfDay(localDayOf(toEpochSeconds(window.until), 0));
  return Array.from(
    { length: (last - first) / DAYS_PER_WEEK + 1 },
    (_, index) => isoDateOfDay(first + index * DAYS_PER_WEEK),
  );
};

/**
 * Every month from the month containing `window.since` through the month
 * containing `window.until`, oldest first, without gaps.
 */
export const monthsOf = (window: TimeRange): ReadonlyArray<string> => {
  const first = new Date(window.since);
  const last = new Date(window.until);
  const count =
    (last.getUTCFullYear() - first.getUTCFullYear()) * 12 +
    last.getUTCMonth() -
    first.getUTCMonth() +
    1;
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + index, 1))
      .toISOString()
      .slice(0, 7),
  );
};
