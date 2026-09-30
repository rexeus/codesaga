// Owns the order in which the analysis reads commits, so that a history read
// whole and one assembled from a cache agree.
import type { Commit } from "./parse-log.js";

/** A commit whose committer date git cannot read is the oldest there is. */
const committedAt = (commit: Commit): number =>
  Number.isNaN(commit.committerTime) ? -Infinity : commit.committerTime;

const byNewest = (a: Commit, b: Commit): number => {
  const [timeA, timeB] = [committedAt(a), committedAt(b)];
  if (timeA !== timeB) {
    return timeA > timeB ? -1 : 1;
  }
  if (a.sha === b.sha) {
    return 0;
  }
  return a.sha < b.sha ? -1 : 1;
};

/**
 * The commits newest first by committer time, equal times by ascending sha: a
 * total order that depends on the set of commits alone, never on how it was
 * assembled. For a history whose committer times do not go backwards it is
 * the order of `git log`.
 */
export const inCanonicalOrder = (
  commits: ReadonlyArray<Commit>,
): ReadonlyArray<Commit> => commits.toSorted(byNewest);
