// Owns what "active" means: a commit in the days before now.
// Experts, contributors and the overview all measure it here, so their numbers agree.
import { DateTime } from "effect";

/** An expert, and the `active` flag of a contributor, need a commit in this many days before now; `thresholds.activeDays`. */
export const ACTIVE_DAYS = 183;

/** An active contributor, and the overview's `active90`, need a commit in this many days before now. */
export const ACTIVE_CONTRIBUTOR_DAYS = 90;

const SECONDS_PER_DAY = 86_400;

/** Whether a commit at `lastCommitTime` (seconds since the epoch) lies at most `days` days before `now`. */
export const isActiveWithin = (
  lastCommitTime: number,
  now: DateTime.Utc,
  days: number,
): boolean =>
  lastCommitTime >= DateTime.toEpochMillis(now) / 1000 - days * SECONDS_PER_DAY;
