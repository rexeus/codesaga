import { formatCount } from "./format.js";
import { LOW_TRUCK_FACTOR } from "./territories.js";
import type { Detail, Territory } from "./territory-details.js";

const DAYS_PER_MONTH = 30.4;

/**
 * The territories of a detail that stand for themselves, without the groups of other
 * files. The engine's recommendation counts these, so the slider does too; a
 * detail the output limit cut counts all its territories, since the cut-off ones
 * cannot be told apart.
 */
export const namedTerritories = (detail: Detail): number =>
  detail.totalTerritories > detail.territories.length
    ? detail.totalTerritories
    : detail.territories.filter(({ kind }) => kind !== "other").length;

/** What the line above the cards counts: territories, covered files and the risky ones. */
export type DetailSummary = {
  readonly territories: number;
  /** The groups of other files beside the territories. */
  readonly otherGroups: number;
  readonly coveredFiles: number;
  readonly totalFiles: number;
  readonly lowTruckFactor: number;
  readonly islands: number;
  readonly orphaned: number;
  /** A note when the report's output limit cut territories off; null otherwise. */
  readonly truncated: string | null;
};

const countWhere = (
  territories: readonly Territory[],
  test: (territory: Territory) => boolean,
): number => territories.filter((territory) => test(territory)).length;

/** The summary of a detail against the repository's `totalFiles`. */
export const detailSummary = (
  detail: Detail,
  totalFiles: number,
): DetailSummary => ({
  territories: namedTerritories(detail),
  otherGroups: countWhere(detail.territories, ({ kind }) => kind === "other"),
  coveredFiles: detail.territories.reduce((sum, { files }) => sum + files, 0),
  totalFiles,
  lowTruckFactor: countWhere(
    detail.territories,
    ({ truckFactor }) => truckFactor <= LOW_TRUCK_FACTOR,
  ),
  islands: countWhere(detail.territories, ({ island }) => island),
  orphaned: countWhere(detail.territories, ({ orphaned }) => orphaned),
  truncated:
    detail.totalTerritories > detail.territories.length
      ? `Showing the ${formatCount(detail.territories.length)} riskiest of ${formatCount(detail.totalTerritories)} territories: the report was limited.`
      : null,
});

/** The legend entry for dormant experts: months from `thresholds.activeDays`. */
export const dormantLegend = (activeDays: number): string =>
  `Dormant for ${Math.round(activeDays / DAYS_PER_MONTH)}+ months`;
