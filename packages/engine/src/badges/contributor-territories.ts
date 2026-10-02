// Owns how a contributor's commits fall into territories, for the badges that read where a person works.
// Apart from the rules because focus and journey badges both need it.
// Cost: one lookup per changed path into the territories.
import type { ClassifiedCommit } from "../automation/classify.js";
import type { ContributorBadgeTerritory } from "./contributor-badge-facts.js";

export type TerritoryActivity = {
  /** Commits per territory, each commit counting once per territory it touches; territories without a commit are absent. */
  readonly perTerritory: ReadonlyMap<ContributorBadgeTerritory, number>;
  /** Commits that touch at least one of the territories. */
  readonly inTerritories: number;
};

/** The territories that are not leftovers. */
export const namedTerritories = (
  territories: ReadonlyArray<ContributorBadgeTerritory>,
): ReadonlyArray<ContributorBadgeTerritory> =>
  territories.filter(({ kind }) => kind !== "other");

export const territoryActivity = (
  commits: ReadonlyArray<ClassifiedCommit>,
  territories: ReadonlyArray<ContributorBadgeTerritory>,
): TerritoryActivity => {
  const territoryOfPath = new Map(
    namedTerritories(territories).flatMap((territory) =>
      territory.paths.map((path) => [path, territory] as const),
    ),
  );
  const perTerritory = new Map<ContributorBadgeTerritory, number>();
  let inTerritories = 0;
  for (const { changes } of commits) {
    const touched = new Set(
      changes.flatMap(({ path }) => territoryOfPath.get(path) ?? []),
    );
    inTerritories += touched.size > 0 ? 1 : 0;
    for (const territory of touched) {
      perTerritory.set(territory, (perTerritory.get(territory) ?? 0) + 1);
    }
  }
  return { perTerritory, inTerritories };
};

/** The path itself, every directory above it and the repository root `.`, as territory paths. */
const prefixesOf = (path: string): ReadonlyArray<string> => {
  const parts = path.split("/");
  return [".", ...parts.map((_, index) => parts.slice(0, index + 1).join("/"))];
};

/**
 * The time of the person's earliest commit under each named territory's
 * `path`, in seconds since the epoch; territories never touched are absent. It
 * reads the paths as the history reports them, so files deleted since count as
 * a visit, which `territory.paths` (today's files) would miss.
 */
export const firstVisits = (
  commits: ReadonlyArray<ClassifiedCommit>,
  territories: ReadonlyArray<ContributorBadgeTerritory>,
): ReadonlyMap<ContributorBadgeTerritory, number> => {
  const atPath = new Map<string, ContributorBadgeTerritory[]>();
  for (const territory of namedTerritories(territories)) {
    atPath.set(territory.path, [
      ...(atPath.get(territory.path) ?? []),
      territory,
    ]);
  }
  const first = new Map<ContributorBadgeTerritory, number>();
  for (const { changes, time } of commits) {
    for (const { path } of changes) {
      for (const territory of prefixesOf(path).flatMap(
        (prefix) => atPath.get(prefix) ?? [],
      )) {
        first.set(territory, Math.min(first.get(territory) ?? time, time));
      }
    }
  }
  return first;
};
