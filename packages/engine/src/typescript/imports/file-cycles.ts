// Owns the import cycles of the production files: the components of the graph in which every file reaches every other.
// A cycle by value edges costs at runtime; one that exists only through `import type` costs nothing, so both are told apart.

import type { Imports } from "../../report/typescript-imports.js";
import type { ImportGraph } from "./import-graph.js";
import { stronglyConnected } from "./scc.js";

const TOP_CYCLES = 3;
const LISTED_FILES = 10;

/** The cycles of a graph, each a list of node numbers in path order, largest first. */
export type FileCycles = {
  /** By value edges. */
  readonly value: ReadonlyArray<ReadonlyArray<number>>;
  /** By every edge, type-only ones included. */
  readonly withTypes: ReadonlyArray<ReadonlyArray<number>>;
};

const bySizeThenPath = (
  left: ReadonlyArray<number>,
  right: ReadonlyArray<number>,
): number => right.length - left.length || (left[0] ?? 0) - (right[0] ?? 0);

/** The components with a cycle: two files or more, or one that imports itself. */
const cyclesOver = (
  graph: ImportGraph,
  includesTypes: boolean,
): ReadonlyArray<ReadonlyArray<number>> => {
  const successors = graph.paths.map((): Array<number> => []);
  const selfImporting = new Set<number>();
  for (const { from, to, isType } of graph.edges) {
    const isProduction =
      graph.isTest[from] !== true && graph.isTest[to] !== true;
    if (isProduction && (includesTypes || !isType)) {
      successors[from]?.push(to);
      if (from === to) {
        selfImporting.add(from);
      }
    }
  }
  return stronglyConnected(successors)
    .filter(
      (component) =>
        component.length > 1 || selfImporting.has(component[0] ?? -1),
    )
    .map((component) => component.toSorted((left, right) => left - right))
    .toSorted(bySizeThenPath);
};

/** The cycles of the production files, by value edges and with type-only edges too. */
export const cyclesOf = (graph: ImportGraph): FileCycles => ({
  value: cyclesOver(graph, false),
  withTypes: cyclesOver(graph, true),
});

/**
 * The cycles block. `spanOf` counts the territories a list of paths lies in.
 * A cycle counts as type-only when none of its files is in a cycle by value
 * edges.
 */
export const cyclesFigures = (
  graph: ImportGraph,
  { value, withTypes }: FileCycles,
  spanOf: (paths: ReadonlyArray<string>) => number,
): Imports["files"]["cycles"] => {
  const inValueCycle = new Set(value.flat());
  return {
    count: value.length,
    largest: value[0]?.length ?? 0,
    top: value.slice(0, TOP_CYCLES).map((component) => {
      const paths = component.map((node) => graph.paths[node] ?? "");
      return {
        size: component.length,
        files: paths.slice(0, LISTED_FILES),
        territories: spanOf(paths),
      };
    }),
    withTypes: { count: withTypes.length, largest: withTypes[0]?.length ?? 0 },
    typeOnly: withTypes.filter(
      (component) => !component.some((node) => inValueCycle.has(node)),
    ).length,
  };
};
