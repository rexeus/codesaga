// Owns the order in which the analysis reads commits: every child before its
// parents, the same for a history read whole and one assembled from a cache.
import type { Commit } from "./parse-log.js";

/** A commit whose committer date git cannot read is the oldest there is. */
const committedAt = (commit: Commit): number =>
  Number.isNaN(commit.committerTime) ? -Infinity : commit.committerTime;

/** Whether `a` is to be emitted before `b`: newer committer time first, then ascending sha. */
const comesFirst = (a: Commit, b: Commit): boolean => {
  const [timeA, timeB] = [committedAt(a), committedAt(b)];
  return timeA === timeB ? a.sha < b.sha : timeA > timeB;
};

/**
 * The commits ready to be emitted, the one to emit first at the end, so taking
 * it is cheap and inserting is a binary search. The queue holds the open
 * branches of the graph, which is few next to the commits.
 */
const insertReady = (ready: Array<Commit>, commit: Commit): void => {
  let [low, high] = [0, ready.length];
  while (low < high) {
    const middle = (low + high) >> 1;
    const candidate = ready[middle];
    if (candidate !== undefined && comesFirst(candidate, commit)) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  ready.splice(low, 0, commit);
};

/**
 * The commits newest first, with every child before its parents: a
 * topological order of the commit graph (Kahn's algorithm). Among the commits
 * ready to be emitted, the newest committer time goes first, equal times by
 * ascending sha, so the order depends on the set of commits alone, never on
 * how it was assembled. It is not the order of `git log` where committer
 * times disagree with the graph. Parents outside the set are ignored.
 *
 * Rename and deletion resolution walks this order and relies on it: a
 * timestamp order would put a child after its parent when clocks disagree or
 * commits share a second.
 */
export const inTopologicalOrder = (
  commits: ReadonlyArray<Commit>,
): ReadonlyArray<Commit> => {
  const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
  const parentsOf = (commit: Commit): ReadonlyArray<Commit> =>
    [...new Set(commit.parents)].flatMap((sha) => bySha.get(sha) ?? []);
  const waitingOn = new Map<string, number>();
  for (const commit of bySha.values()) {
    for (const parent of parentsOf(commit)) {
      waitingOn.set(parent.sha, (waitingOn.get(parent.sha) ?? 0) + 1);
    }
  }
  const ready: Array<Commit> = [];
  for (const commit of bySha.values()) {
    if (!waitingOn.has(commit.sha)) {
      insertReady(ready, commit);
    }
  }
  const ordered: Array<Commit> = [];
  for (let next = ready.pop(); next !== undefined; next = ready.pop()) {
    ordered.push(next);
    for (const parent of parentsOf(next)) {
      const remaining = (waitingOn.get(parent.sha) ?? 1) - 1;
      waitingOn.set(parent.sha, remaining);
      if (remaining === 0) {
        insertReady(ready, parent);
      }
    }
  }
  return ordered;
};
