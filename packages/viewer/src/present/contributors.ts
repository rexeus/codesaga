import type { Report } from "@codesaga/engine";

import type { Direction, SortState } from "./sort-state.js";

type Contributor = Report["contributors"][number];

/** A sortable column of the contributors table. */
type ContributorSortKey =
  | "name"
  | "commits"
  | "activeDays"
  | "added"
  | "deleted"
  | "firstCommitAt"
  | "lastCommitAt"
  | "areas"
  | "active";

const TEXT_COLUMNS = new Set(["name", "areas"]);

/** Names and areas read A to Z first; counts, dates and status start with the most. */
export const naturalDirection = (key: string): Direction =>
  TEXT_COLUMNS.has(key) ? "asc" : "desc";

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, "en", { sensitivity: "base" });

const comparisons: Record<
  ContributorSortKey,
  (left: Contributor, right: Contributor) => number
> = {
  name: (left, right) =>
    compareText(left.name, right.name) || compareText(left.email, right.email),
  commits: (left, right) => left.commits - right.commits,
  activeDays: (left, right) => left.activeDays - right.activeDays,
  added: (left, right) => left.added - right.added,
  deleted: (left, right) => left.deleted - right.deleted,
  firstCommitAt: (left, right) =>
    Date.parse(left.firstCommitAt) - Date.parse(right.firstCommitAt),
  lastCommitAt: (left, right) =>
    Date.parse(left.lastCommitAt) - Date.parse(right.lastCommitAt),
  areas: (left, right) =>
    compareText(left.areas[0]?.path ?? "", right.areas[0]?.path ?? ""),
  active: (left, right) => Number(left.active) - Number(right.active),
};

const isSortKey = (key: string): key is ContributorSortKey =>
  Object.hasOwn(comparisons, key);

/**
 * The contributors ordered by one column. Equal values keep the report's
 * order (commits, then name), so a sort never scrambles ties. An unknown key
 * leaves the order unchanged.
 */
export const sortContributors = (
  contributors: readonly Contributor[],
  { key, direction }: SortState,
): Contributor[] => {
  if (!isSortKey(key)) {
    return [...contributors];
  }
  const sign = direction === "asc" ? 1 : -1;
  return contributors.toSorted(
    (left, right) => sign * comparisons[key](left, right),
  );
};
