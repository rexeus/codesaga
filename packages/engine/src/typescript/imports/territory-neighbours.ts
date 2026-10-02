// Owns what the import edges say of any one territory, whatever its detail: the territories of the map it imports, the ones that import it, and whether a file cycle leaves it.
// A territory of the map is judged against the others; a territory above or below the map's detail is judged against the map's territories it shares no file with.

import type {
  TerritoryImports,
  TerritoryRef,
} from "../../report/typescript-imports.js";
import type { FileCycles } from "./file-cycles.js";
import type { ImportGraph } from "./import-graph.js";
import { refOf } from "./territory-assignment.js";
import type { Assignment } from "./territory-assignment.js";

const byRef = (left: TerritoryRef, right: TerritoryRef): number =>
  Number(left.path > right.path) - Number(left.path < right.path) ||
  Number(left.kind > right.kind) - Number(left.kind < right.kind);

/** For each node, the territories of the production files it imports and the ones that import it. */
const neighboursOf = (
  graph: ImportGraph,
  { of }: Assignment,
): {
  readonly imports: ReadonlyArray<Set<number>>;
  readonly importedBy: ReadonlyArray<Set<number>>;
} => {
  const imports = graph.paths.map(() => new Set<number>());
  const importedBy = graph.paths.map(() => new Set<number>());
  for (const { from, to } of graph.edges) {
    const source = of[from] ?? -1;
    const target = of[to] ?? -1;
    if (
      from !== to &&
      graph.isTest[from] !== true &&
      graph.isTest[to] !== true
    ) {
      if (target >= 0) {
        imports[from]?.add(target);
      }
      if (source >= 0) {
        importedBy[to]?.add(source);
      }
    }
  }
  return { imports, importedBy };
};

/** The component of each node among the cycles by value edges, -1 for a node in none, and the size of each. */
const cycleMembership = (
  graph: ImportGraph,
  { value }: FileCycles,
): {
  readonly of: ReadonlyArray<number>;
  readonly sizes: ReadonlyArray<number>;
} => {
  const of = graph.paths.map(() => -1);
  value.forEach((component, id) => {
    for (const node of component) {
      of[node] = id;
    }
  });
  return { of, sizes: value.map((component) => component.length) };
};

/**
 * A function from the universe paths of a territory to what the import graph
 * says of it: undefined when none of them is a file of the graph. A territory
 * is in a cycle when a cycle by value edges has a file in it and a file out of
 * it, which a self-import alone does not make.
 */
export const territoryImportsOf = (
  graph: ImportGraph,
  assignment: Assignment,
  cycles: FileCycles,
): ((paths: ReadonlyArray<string>) => TerritoryImports | undefined) => {
  const { imports, importedBy } = neighboursOf(graph, assignment);
  const membership = cycleMembership(graph, cycles);
  const refsOf = (
    territories: ReadonlySet<number>,
  ): ReadonlyArray<TerritoryRef> =>
    [...territories]
      .flatMap((index) => assignment.territories[index] ?? [])
      .map((territory) => refOf(territory))
      .toSorted(byRef);
  return (paths) => {
    const nodes = paths.flatMap((path) => graph.indexOf.get(path) ?? []);
    if (nodes.length === 0) {
      return undefined;
    }
    const own = new Set(nodes.map((node) => assignment.of[node] ?? -1));
    const reached = (sets: ReadonlyArray<Set<number>>): ReadonlySet<number> =>
      new Set(
        nodes.flatMap((node) =>
          [...(sets[node] ?? [])].filter((index) => !own.has(index)),
        ),
      );
    const inside = new Map<number, number>();
    for (const node of nodes) {
      const id = membership.of[node] ?? -1;
      if (id >= 0) {
        inside.set(id, (inside.get(id) ?? 0) + 1);
      }
    }
    return {
      imports: refsOf(reached(imports)),
      importedBy: refsOf(reached(importedBy)),
      inCycle: [...inside].some(
        ([id, count]) => count < (membership.sizes[id] ?? 0),
      ),
    };
  };
};
