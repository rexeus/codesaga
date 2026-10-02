// Owns how a contributor's commits fall into territories, for the badges that read where a person works.
// Apart from the rules because focus and journey badges both need it.
// Cost: one lookup per changed path into the territories.
import type { ClassifiedCommit } from "../automation/classify.js";
import type { ContributorBadgeTerritory } from "./contributor-badge-facts.js";

export type TerritoryActivity = {
  /** Commits per territory, each commit counting once per territory it touches; territories without a commit are absent. */
  readonly perTerritory: ReadonlyMap<ContributorBadgeTerritory, number>;
  /** The time of the earliest commit that touches each territory in `perTerritory`, in seconds since the epoch. */
  readonly firstTouch: ReadonlyMap<ContributorBadgeTerritory, number>;
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
  const firstTouch = new Map<ContributorBadgeTerritory, number>();
  let inTerritories = 0;
  for (const { changes, time } of commits) {
    const touched = new Set(
      changes.flatMap(({ path }) => territoryOfPath.get(path) ?? []),
    );
    inTerritories += touched.size > 0 ? 1 : 0;
    for (const territory of touched) {
      perTerritory.set(territory, (perTerritory.get(territory) ?? 0) + 1);
      firstTouch.set(
        territory,
        Math.min(firstTouch.get(territory) ?? time, time),
      );
    }
  }
  return { perTerritory, firstTouch, inTerritories };
};
