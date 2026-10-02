// Owns a contributor's status: new, active or dormant. It decides the order of the contributor cards.
// "New" reads the full history, because a narrowed window would make everyone in it look new.
// Pure arithmetic over two times.

import type { DateTime } from "effect";

import { ACTIVE_DAYS, isActiveWithin } from "./activeness.js";

/** A contributor is new when their first commit lies at most this many days before now. */
export const NEW_CONTRIBUTOR_DAYS = 90;

export type ContributorStatus = "new" | "active" | "dormant";

/**
 * Whether a contributor whose first commit is at `firstCommitTime` is new: it
 * lies at most `NEW_CONTRIBUTOR_DAYS` days before `now`, and someone committed
 * before it, since the founder of a young repository is nobody's newcomer.
 * `repositoryStart` is the first commit of anyone who counts as a contributor.
 * Times are seconds since the epoch.
 */
export const isNewContributor = (
  firstCommitTime: number,
  repositoryStart: number,
  now: DateTime.Utc,
): boolean =>
  firstCommitTime > repositoryStart &&
  isActiveWithin(firstCommitTime, now, NEW_CONTRIBUTOR_DAYS);

/**
 * `dormant` without a commit in the `ACTIVE_DAYS` days before `now`; `new`
 * under `isNewContributor`; otherwise `active`.
 */
export const contributorStatus = (
  firstCommitTime: number,
  lastCommitTime: number,
  repositoryStart: number,
  now: DateTime.Utc,
): ContributorStatus => {
  if (!isActiveWithin(lastCommitTime, now, ACTIVE_DAYS)) {
    return "dormant";
  }
  return isNewContributor(firstCommitTime, repositoryStart, now)
    ? "new"
    : "active";
};
