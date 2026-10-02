// Owns the areas of a repository with their knowledge: the partition per level, described and ordered.
// Sits beside `directories.ts`, which it replaces in the report; `directories` stays for schemaVersion 1.
// Cost: the partition, then each area is described once per level, so every file once per level.

import { Array as Arr, Order } from "effect";

import type { AreaKnowledge, AreaLevel } from "../report/knowledge-report.js";
import { partitionLevels } from "./area-partition.js";
import type { PartitionInput } from "./area-partition.js";
import { byRisk, describeDirectory } from "./directories.js";
import type { KnowledgeModel } from "./model.js";

/** An area with the universe files it holds, which the badges need and the report leaves out. */
export type AreaWithFiles = Omit<AreaKnowledge, "badges"> & {
  /** The area's universe files, repository-relative. */
  readonly paths: ReadonlyArray<string>;
};

/** One level of the partition. */
export type AreaLevelWithFiles = Omit<AreaLevel, "areas"> & {
  readonly areas: ReadonlyArray<AreaWithFiles>;
};

const restLast = Order.mapInput(
  Order.Boolean,
  (area: AreaWithFiles) => area.kind === "rest",
);

const byRestThenRisk = Order.combine(restLast, byRisk);

/**
 * The partition of the universe at levels 1 to the deepest useful one (see
 * `partitionLevels` for how it is cut), each area with the knowledge of its
 * files. Areas are ordered riskiest first like `directoryKnowledge`, except
 * that the `rest` areas, whose files no one group owns, come last.
 * `totalAreas` counts the areas of the level; callers that truncate keep it.
 */
export const areaLevels = (
  input: PartitionInput & { readonly model: KnowledgeModel },
): Arr.NonEmptyReadonlyArray<AreaLevelWithFiles> =>
  Arr.map(partitionLevels(input), ({ depth, areas }) => ({
    depth,
    totalAreas: areas.length,
    areas: areas
      .map(({ path, kind, paths }): AreaWithFiles => ({
        ...describeDirectory(path, paths, input.model),
        kind,
        paths,
      }))
      .toSorted(byRestThenRisk),
  }));
