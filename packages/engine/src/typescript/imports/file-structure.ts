// Owns the file-level figures of the import graph: its size, the specifiers that were not resolved, fan-in and fan-out, and the cycles.
// Production files and their edges only: a test imports production code by design, so it would swamp every figure.

import type { Imports } from "../../report/typescript-imports.js";
import { ratioOf } from "../../stats/measures.js";
import { cyclesFigures } from "./file-cycles.js";
import type { FileCycles } from "./file-cycles.js";
import type { ImportGraph } from "./import-graph.js";

const TOP_FILES = 5;
const TOP_SPECIFIERS = 5;

const isProduction = (graph: ImportGraph, node: number): boolean =>
  graph.isTest[node] !== true;

const byCountThenKey = (
  left: readonly [string, number],
  right: readonly [string, number],
): number =>
  right[1] - left[1] || Number(left[0] > right[0]) - Number(left[0] < right[0]);

const median = (values: ReadonlyArray<number>): number => {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/** How many production files each production file imports and is imported by, self-imports left out. */
const fansOf = (
  graph: ImportGraph,
): { readonly fanIn: Array<number>; readonly fanOut: Array<number> } => {
  const fanIn = graph.paths.map(() => 0);
  const fanOut = graph.paths.map(() => 0);
  for (const { from, to } of graph.edges) {
    if (from !== to && isProduction(graph, from) && isProduction(graph, to)) {
      fanIn[to] = (fanIn[to] ?? 0) + 1;
      fanOut[from] = (fanOut[from] ?? 0) + 1;
    }
  }
  return { fanIn, fanOut };
};

const topFiles = (
  graph: ImportGraph,
  counts: ReadonlyArray<number>,
): Imports["files"]["fanIn"]["top"] =>
  counts
    .map((count, node): readonly [string, number] => [
      graph.paths[node] ?? "",
      count,
    ])
    .filter(([, count]) => count > 0)
    .toSorted(byCountThenKey)
    .slice(0, TOP_FILES)
    .map(([path, count]) => ({ path, count }));

const unresolvedOf = (graph: ImportGraph): Imports["files"]["unresolved"] => {
  const { resolved, unresolved } = graph.requests;
  const count = [...unresolved.values()].reduce((sum, files) => sum + files, 0);
  return {
    count,
    share: ratioOf(count, count + resolved),
    top: [...unresolved]
      .toSorted(byCountThenKey)
      .slice(0, TOP_SPECIFIERS)
      .map(([specifier, files]) => ({ specifier, files })),
  };
};

const edgesOf = (graph: ImportGraph): Imports["files"]["edges"] => {
  let value = 0;
  let typeOnly = 0;
  let tests = 0;
  for (const { from, to, isType } of graph.edges) {
    if (!isProduction(graph, from) || !isProduction(graph, to)) {
      tests += 1;
    } else if (isType) {
      typeOnly += 1;
    } else {
      value += 1;
    }
  }
  return { value, typeOnly, tests };
};

/**
 * The file-level block over `graph` and its `cycles`; `spanOf` counts the
 * territories a list of paths lies in.
 */
export const fileStructureOf = (
  graph: ImportGraph,
  cycles: FileCycles,
  spanOf: (paths: ReadonlyArray<string>) => number,
): Imports["files"] => {
  const { fanIn, fanOut } = fansOf(graph);
  const production = graph.paths.flatMap((_, node) =>
    isProduction(graph, node) ? [node] : [],
  );
  return {
    files: production.length,
    testFiles: graph.paths.length - production.length,
    edges: edgesOf(graph),
    external: graph.requests.external,
    assets: graph.requests.assets,
    dynamicUnresolvable: graph.requests.dynamicUnresolvable,
    unresolved: unresolvedOf(graph),
    cycles: cyclesFigures(graph, cycles, spanOf),
    fanIn: {
      median: median(production.map((node) => fanIn[node] ?? 0)),
      top: topFiles(graph, fanIn),
    },
    fanOut: { top: topFiles(graph, fanOut) },
  };
};
