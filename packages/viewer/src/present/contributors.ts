import type { Report } from "@codesaga/engine";

import { contributorBadges } from "./badges.js";
import type { BadgeRow } from "./badges.js";
import {
  formatAgo,
  formatCount,
  formatDateLong,
  formatMonth,
} from "./format.js";
import { initialsOf, personEntities } from "./people.js";

type Contributor = Report["contributors"][number];
type Status = Contributor["status"];

/**
 * The filter buttons above the list. `active` includes the new people, as the
 * dashboard's active contributors do (a commit in the last 90 days); `new` is
 * the part of them whose first commit is recent.
 */
export type StatusFilter = "all" | Status;

/** How many people are listed before the reader asks for all. */
export const PEOPLE_SHOWN = 12;
const AREA_CHIPS_SHOWN = 2;
export const RECENT_WEEKS = 12;
const GROUP: Record<Status, number> = { active: 0, new: 1, dormant: 2 };
const FILTERS: readonly { filter: StatusFilter; label: string }[] = [
  { filter: "all", label: "All" },
  { filter: "active", label: "Active" },
  { filter: "new", label: "New" },
  { filter: "dormant", label: "Dormant" },
];

/** A directory as the list names it; the engine's "." is the repository root. */
const areaName = (path: string): string => (path === "." ? "root" : path);

/** One contributor as a row of the list. */
export type PersonRow = {
  readonly key: string;
  readonly name: string;
  readonly initials: string;
  readonly entity: string;
  readonly status: Status;
  /** `since May 2025 · 178 commits`. */
  readonly since: string;
  readonly weekly: readonly number[];
  readonly areas: readonly string[];
  readonly moreAreas: number;
  readonly badges: BadgeRow;
  /** `7 weeks ago`, and the date it was. */
  readonly lastAgo: string;
  readonly lastDate: string;
};

/**
 * Active people first, then new ones, then dormant ones; within a group the
 * people with the most days with a commit first, then by name.
 */
const orderContributors = (
  contributors: readonly Contributor[],
): Contributor[] =>
  contributors.toSorted(
    (left, right) =>
      GROUP[left.status] - GROUP[right.status] ||
      right.activeDays - left.activeDays ||
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );

/** The rows of the list, in list order. */
export const personRows = (report: Report): PersonRow[] => {
  const entityOf = personEntities(report.contributors);
  return orderContributors(report.contributors).map((person) => ({
    key: person.email,
    name: person.name,
    initials: initialsOf(person.name),
    entity: entityOf(person.email),
    status: person.status,
    since: `since ${formatMonth(person.firstCommitAt)} · ${formatCount(person.commits)} ${person.commits === 1 ? "commit" : "commits"}`,
    weekly: person.weekly,
    areas: person.areas
      .slice(0, AREA_CHIPS_SHOWN)
      .map(({ path }) => areaName(path)),
    moreAreas: Math.max(0, person.areas.length - AREA_CHIPS_SHOWN),
    badges: contributorBadges(person.badges),
    lastAgo: formatAgo(person.lastCommitAt, report.generatedAt),
    lastDate: formatDateLong(person.lastCommitAt),
  }));
};

const matches = (status: Status, filter: StatusFilter): boolean => {
  if (filter === "all") {
    return true;
  }
  return filter === "active" ? status !== "dormant" : status === filter;
};

/** A filter button with the number of people behind it. */
export type FilterOption = {
  readonly filter: StatusFilter;
  readonly label: string;
  readonly count: number;
};

/**
 * The buttons of the filter row: All, and each status someone has. No row at
 * all for fewer than two people, where there is nothing to filter.
 */
export const filterOptions = (rows: readonly PersonRow[]): FilterOption[] => {
  if (rows.length < 2) {
    return [];
  }
  return FILTERS.map(({ filter, label }) => ({
    filter,
    label,
    count: rows.filter(({ status }) => matches(status, filter)).length,
  })).filter(({ filter, count }) => filter === "all" || count > 0);
};

/** The rows `filter` lets through, in list order. */
export const rowsWithFilter = (
  rows: readonly PersonRow[],
  filter: StatusFilter,
): PersonRow[] => rows.filter(({ status }) => matches(status, filter));
