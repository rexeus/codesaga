// Owns which territory of the map each file of the import graph lies in.

import type { TerritoryRef } from "../../report/typescript-imports.js";
import type { ImportGraph } from "./import-graph.js";

/** A territory as the knowledge section shows it at the report's detail: its name and the universe files it holds. */
export type VisibleTerritory = TerritoryRef & {
  readonly paths: ReadonlyArray<string>;
};

/** The territories of the map and the territory of each graph node. */
export type Assignment = {
  readonly territories: ReadonlyArray<VisibleTerritory>;
  /** The position in `territories` of the territory of each node; -1 for a node in none. */
  readonly of: ReadonlyArray<number>;
};

/** Each node of `graph` in the visible territory that holds its path. */
export const assignmentOf = (
  graph: ImportGraph,
  territories: ReadonlyArray<VisibleTerritory>,
): Assignment => {
  const byPath = new Map(
    territories.flatMap(({ paths }, index) =>
      paths.map((path): readonly [string, number] => [path, index]),
    ),
  );
  return {
    territories,
    of: graph.paths.map((path) => byPath.get(path) ?? -1),
  };
};

/** The reference that names a territory in the report. */
export const refOf = ({ path, kind }: TerritoryRef): TerritoryRef => ({
  path,
  kind,
});
