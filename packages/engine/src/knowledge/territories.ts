// Owns the territories of a repository with their knowledge: the partition tree, described and ordered.
// Sits beside `directories.ts`, which it replaces in the report; `directories` stays for schemaVersion 1.
// Cost: the partition, then each territory is described once, so every file once per tree level.

import { Order } from "effect";

import type { CodeStats } from "../report/code-stats.js";
import type { Territory } from "../report/knowledge-report.js";
import { byRisk, describeDirectory } from "./directories.js";
import type { KnowledgeModel } from "./model.js";
import { partitionTerritories } from "./territory-partition.js";
import type {
  PartitionInput,
  PartitionTerritory,
} from "./territory-partition.js";
import { TERRITORY_MIN_FILES } from "./territory-tree.js";

/** A territory with the universe files it holds, which the badges need and the report leaves out; badges, dates and stats are added from the history and the files. */
export type TerritoryWithFiles = Omit<
  Territory,
  "badges" | "lastChangedAt" | "stats" | "territories"
> & {
  /** The territory's universe files, repository-relative, including those of its children. */
  readonly paths: ReadonlyArray<string>;
  readonly territories: ReadonlyArray<TerritoryWithFiles>;
};

/** A territory with the code stats of its files, as the badge rules compare it; its children are measured too. */
export type MeasuredTerritory = Omit<TerritoryWithFiles, "territories"> & {
  readonly stats: CodeStats;
  readonly territories: ReadonlyArray<MeasuredTerritory>;
};

/** The territories described, and how their details run. */
export type TerritoryTree = {
  /** The first cut: riskiest first, `other` territories last, as every list of siblings. */
  readonly territories: ReadonlyArray<TerritoryWithFiles>;
  /** The finest detail, from 1. */
  readonly maxDetail: number;
  /** The last detail that separates folders with different experts, from 1. */
  readonly expertiseDetail: number;
};

const restLast = Order.mapInput(
  Order.Boolean,
  (territory: TerritoryWithFiles) => territory.kind === "other",
);

const byRestThenRisk = Order.combine(restLast, byRisk);

/**
 * An `other` territory under `TERRITORY_MIN_FILES` files is a leftover, not a unit of
 * knowledge: one or two files would always read as an island or as orphaned.
 */
const describeTerritory = (
  {
    path,
    kind,
    paths,
    territories: children,
    splitReason,
    splitDetail,
  }: PartitionTerritory,
  model: KnowledgeModel,
): TerritoryWithFiles => {
  const described = describeDirectory(path, paths, model);
  const isLeftover = kind === "other" && paths.length < TERRITORY_MIN_FILES;
  const territories = children
    .map((child) => describeTerritory(child, model))
    .toSorted(byRestThenRisk);
  return {
    ...described,
    ...(isLeftover ? { island: false, orphaned: false, reasons: [] } : {}),
    kind,
    paths,
    territories,
    totalTerritories: territories.length,
    ...(splitReason === undefined ? {} : { splitReason }),
    ...(splitDetail === undefined ? {} : { splitDetail }),
  };
};

/**
 * The partition tree of the universe (see `partitionTerritories` for how it is
 * cut), each territory with the knowledge of its files. Siblings are ordered
 * riskiest first like `directoryKnowledge`, except that the `other` territories, whose
 * files no one group owns, come last. Experts are those of the knowledge model.
 */
export const territoryTree = (
  input: Omit<PartitionInput, "expertsOf"> & {
    readonly model: KnowledgeModel;
  },
): TerritoryTree => {
  const { model } = input;
  const { territories, maxDetail, expertiseDetail } = partitionTerritories({
    ...input,
    expertsOf: (path) =>
      (model.experts.get(path) ?? []).map(({ email }) => email),
  });
  return {
    territories: territories
      .map((territory) => describeTerritory(territory, model))
      .toSorted(byRestThenRisk),
    maxDetail,
    expertiseDetail,
  };
};

/**
 * The territories shown at `detail`: a territory whose `splitDetail` is at most
 * `detail` is replaced by its children, recursively. They cover every file exactly once.
 */
export const territoriesAtDetail = <
  T extends {
    readonly splitDetail?: number | undefined;
    readonly territories: ReadonlyArray<T>;
  },
>(
  territories: ReadonlyArray<T>,
  detail: number,
): ReadonlyArray<T> =>
  territories.flatMap((territory) =>
    territory.splitDetail !== undefined && territory.splitDetail <= detail
      ? territoriesAtDetail(territory.territories, detail)
      : [territory],
  );

/**
 * The territories with the code stats of their files, children included.
 * `statsOf` measures the files at the given paths.
 */
export const measureTerritories = (
  territories: ReadonlyArray<TerritoryWithFiles>,
  statsOf: (paths: ReadonlyArray<string>) => CodeStats,
): ReadonlyArray<MeasuredTerritory> =>
  territories.map((territory) => ({
    ...territory,
    stats: statsOf(territory.paths),
    territories: measureTerritories(territory.territories, statsOf),
  }));
