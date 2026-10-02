// Owns a contributor's status: new, active or dormant. It decides the order of the contributor cards.
// "New" reads the full history, because a narrowed window would make everyone in it look new.
// Pure arithmetic over two times.

import type { DateTime } from "effect";

import { ACTIVE_DAYS, isActiveWithin } from "./activeness.js";

/** A contributor is new when their first commit lies at most this many days before now. */
export const NEW_CONTRIBUTOR_DAYS = 90;

export type ContributorStatus = "new" | "active" | "dormant";

/**
 * `dormant` without a commit in the `ACTIVE_DAYS` days before `now`; `new` when
 * the first commit over the full history lies at most `NEW_CONTRIBUTOR_DAYS`
 * days back; otherwise `active`. Times are seconds since the epoch.
 */
export const contributorStatus = (
  firstCommitTime: number,
  lastCommitTime: number,
  now: DateTime.Utc,
): ContributorStatus => {
  if (!isActiveWithin(lastCommitTime, now, ACTIVE_DAYS)) {
    return "dormant";
  }
  return isActiveWithin(firstCommitTime, now, NEW_CONTRIBUTOR_DAYS)
    ? "new"
    : "active";
};
