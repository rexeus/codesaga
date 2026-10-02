// Owns how a milestone's day is told and when it is withheld: a shallow clone cannot say when a threshold was first passed.
// The commits it lacks may have passed it earlier, so the day is null there and the sentence says the figures are at least that much.

import { isoDateOfDay, localDayOf } from "../activity/buckets.js";

/** Appended to the detail of every milestone that counts history, in a shallow clone. */
const SHALLOW_NOTE =
  " The clone is shallow: older history is missing, so this is at least that much.";

/** The `YYYY-MM-DD` (UTC) of a time in seconds since the epoch. */
export const utcDayOf = (time: number): string =>
  isoDateOfDay(localDayOf(time, 0));

/** The UTC day of `time`, or null in a shallow clone and when there is no time. */
export const reachedOn = (
  shallow: boolean,
  time: number | undefined,
): string | null => (shallow || time === undefined ? null : utcDayOf(time));

/** The detail of a history-counting milestone, with the shallow note when it applies. */
export const detailOf = (shallow: boolean, sentence: string): string =>
  shallow ? `${sentence}${SHALLOW_NOTE}` : sentence;
