// Owns the territories of a repository with their knowledge: the partition per detail, described and ordered.
// Sits beside `directories.ts`, which it replaces in the report; `directories` stays for schemaVersion 1.
// Cost: the partition, then each territory is described once per detail, so every file once per detail.

import { Array as Arr, Order } from "effect";

import type { Territory, TerritoryDetail } from "../report/knowledge-report.js";
import { byRisk, describeDirectory } from "./directories.js";
import type { KnowledgeModel } from "./model.js";
import { partitionDetails } from "./territory-partition.js";
import type {
  PartitionTerritory,
  PartitionInput,
} from "./territory-partition.js";
import { TERRITORY_MIN_FILES } from "./territory-tree.js";

/** A territory with the universe files it holds, which the badges need and the report leaves out; badges and dates are added from the history. */
export type TerritoryWithFiles = Omit<Territory, "badges" | "lastChangedAt"> & {
  /** The territory's universe files, repository-relative. */
  readonly paths: ReadonlyArray<string>;
};

/** One detail of the partition. */
export type TerritoryDetailWithFiles = Omit<TerritoryDetail, "territories"> & {
  readonly territories: ReadonlyArray<TerritoryWithFiles>;
};

const restLast = Order.mapInput(
  Order.Boolean,
  (territory: TerritoryWithFiles) => territory.kind === "other",
);

/**
 * An `other` territory under `TERRITORY_MIN_FILES` files is a leftover, not a unit of
 * knowledge: one or two files would always read as an island or as orphaned.
 */
const describeTerritory = (
  { path, kind, paths }: PartitionTerritory,
  model: KnowledgeModel,
): TerritoryWithFiles => {
  const described = describeDirectory(path, paths, model);
  const isLeftover = kind === "other" && paths.length < TERRITORY_MIN_FILES;
  return {
    ...described,
    ...(isLeftover ? { island: false, orphaned: false, reasons: [] } : {}),
    kind,
    paths,
  };
};

const byRestThenRisk = Order.combine(restLast, byRisk);

/**
 * The partition of the universe at details 1 to the deepest useful one (see
 * `partitionDetails` for how it is cut), each territory with the knowledge of its
 * files. Territories are ordered riskiest first like `directoryKnowledge`, except
 * that the `other` territories, whose files no one group owns, come last.
 * `totalTerritories` counts the territories of the detail; callers that truncate keep it.
 */
export const territoryDetails = (
  input: PartitionInput & { readonly model: KnowledgeModel },
): Arr.NonEmptyReadonlyArray<TerritoryDetailWithFiles> =>
  Arr.map(partitionDetails(input), ({ detail, territories }) => ({
    detail,
    totalTerritories: territories.length,
    territories: territories
      .map((territory) => describeTerritory(territory, input.model))
      .toSorted(byRestThenRisk),
  }));
