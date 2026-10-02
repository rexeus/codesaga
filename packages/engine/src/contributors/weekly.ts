// Owns a contributor's commits per week over the last 52 weeks, the sparkline of their card.
// The weeks are those of the activity section (Monday, UTC), counted back from now.
// Cost: one pass over the contributor's commit times.

import { DateTime } from "effect";

import { weekStartOf } from "../activity/buckets.js";

/** The number of weeks in a contributor's sparkline; the report schema fixes it at 52. */
const WEEKLY_WEEKS = 52;

const SECONDS_PER_WEEK = 7 * 86_400;

/**
 * Commits per week over the `WEEKLY_WEEKS` weeks that end with the week of
 * `now`, oldest first. `times` are commit times in seconds since the epoch;
 * those outside the 52 weeks count nowhere.
 */
export const weeklyCommits = (
  times: ReadonlyArray<number>,
  now: DateTime.Utc,
): ReadonlyArray<number> => {
  const nowSeconds = DateTime.toEpochMillis(now) / 1000;
  const indexOfWeek = new Map(
    Array.from({ length: WEEKLY_WEEKS }, (_, index) => [
      weekStartOf(nowSeconds - (WEEKLY_WEEKS - 1 - index) * SECONDS_PER_WEEK),
      index,
    ]),
  );
  const counts = Array.from({ length: WEEKLY_WEEKS }, () => 0);
  for (const time of times) {
    const index = indexOfWeek.get(weekStartOf(time));
    if (index !== undefined) {
      counts[index] = (counts[index] ?? 0) + 1;
    }
  }
  return counts;
};
