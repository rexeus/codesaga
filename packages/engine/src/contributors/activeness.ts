// Owns what "active" means: a commit in the days before now.
// The contributors and the overview both measure it here, so their numbers agree.
import { DateTime } from "effect";

/** A contributor is active with a commit in this many days before now. */
export const ACTIVE_DAYS = 183;

const SECONDS_PER_DAY = 86_400;

/** Whether a commit at `lastCommitTime` (seconds since the epoch) lies at most `days` days before `now`. */
export const isActiveWithin = (
  lastCommitTime: number,
  now: DateTime.Utc,
  days: number,
): boolean =>
  lastCommitTime >= DateTime.toEpochMillis(now) / 1000 - days * SECONDS_PER_DAY;
