import type { ImportGraph } from "../typescript/imports/import-graph.js";
// Tests only: an import graph built from a list of edges, without resolving anything.
import { isTestPath } from "../universe/path-kinds.js";

/** An import of the second path by the first; `"type"` marks one that only brings types. */
type EdgeSpec = readonly [from: string, to: string, kind?: "type"];

/** The graph with the paths named in `edges` and `alone`, which have no edge. */
export const graphOf = (
  edges: ReadonlyArray<EdgeSpec>,
  alone: ReadonlyArray<string> = [],
): ImportGraph => {
  const paths = [
    ...new Set([...edges.flatMap(([from, to]) => [from, to]), ...alone]),
  ].toSorted();
  const indexOf = new Map(paths.map((path, index) => [path, index]));
  return {
    paths,
    indexOf,
    isTest: paths.map((path) => isTestPath(path)),
    edges: edges.map(([from, to, kind]) => ({
      from: indexOf.get(from) ?? -1,
      to: indexOf.get(to) ?? -1,
      isType: kind === "type",
    })),
    requests: {
      resolved: 0,
      external: 0,
      assets: 0,
      dynamicUnresolvable: 0,
      unresolved: new Map(),
    },
  };
};
