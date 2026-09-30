// Owns the main areas of a contributor: the directories they commit to most.
// An area is a directory cut at two levels below the scope, so a deep tree stays readable.
import { Order } from "effect";

import { groupBy } from "../collections/group-by.js";
import type { HistoryCommit } from "../history/history.js";

const MAX_DEPTH = 2;
const MAX_AREAS = 3;

/** The directory of `path`, at most two levels below `scope`; "." for a root-level file. */
const areaOf = (path: string, scope: string): string => {
  const relative = scope === "." ? path : path.slice(scope.length + 1);
  const below = relative.split("/").slice(0, -1).slice(0, MAX_DEPTH);
  return [...(scope === "." ? [] : [scope]), ...below].join("/") || ".";
};

type Area = { readonly path: string; readonly commits: number };

const byCommitsThenPath = Order.combine(
  Order.flip(Order.mapInput(Order.Number, (area: Area) => area.commits)),
  Order.mapInput(Order.String, (area: Area) => area.path),
);

/**
 * The three directories with the most of the commits, each commit counting
 * once per directory it touches; ties by path.
 */
export const topAreas = (
  commits: ReadonlyArray<Pick<HistoryCommit, "changes">>,
  scope: string,
): ReadonlyArray<Area> =>
  [
    ...groupBy(
      commits.flatMap((commit) => [
        ...new Set(commit.changes.map(({ path }) => areaOf(path, scope))),
      ]),
      (path) => path,
    ),
  ]
    .map(([path, touches]) => ({ path, commits: touches.length }))
    .toSorted(byCommitsThenPath)
    .slice(0, MAX_AREAS);
