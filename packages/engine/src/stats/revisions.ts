// Owns counting revisions: how many commits changed each file over the full history.

import type { HistoryCommit } from "../history/history.js";

/**
 * The revisions of every path that appears in `commits`: the commits that
 * changed it, once per commit, in the current life of the path. History
 * resolution already names a renamed file's older changes by its current path,
 * so a rename keeps the count; changes of an earlier life of the path, before
 * a deletion, do not belong to today's file.
 */
export const revisionsOf = (
  commits: ReadonlyArray<Pick<HistoryCommit, "changes">>,
): ReadonlyMap<string, number> => {
  const revisions = new Map<string, number>();
  for (const { changes } of commits) {
    const touched = new Set(
      changes
        .filter(({ previousLife }) => previousLife !== true)
        .map(({ path }) => path),
    );
    for (const path of touched) {
      revisions.set(path, (revisions.get(path) ?? 0) + 1);
    }
  }
  return revisions;
};
