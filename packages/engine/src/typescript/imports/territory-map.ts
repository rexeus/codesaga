// Owns the dependency map between territories: how many import edges run from each territory into each other, and what that says of their stability.
// Instability is Robert C. Martin's `ce / (ca + ce)`, here counted in import edges between files: a description of how a territory is coupled, not a verdict on it.

import type { Imports, TerritoryRef } from "../../report/typescript-imports.js";
import { ratioOf } from "../../stats/measures.js";
import type { ImportGraph } from "./import-graph.js";
import { stronglyConnected } from "./scc.js";
import { refOf } from "./territory-assignment.js";
import type { Assignment } from "./territory-assignment.js";
import { IMPORT_THRESHOLDS } from "./thresholds.js";

/** A territory of the map while it is measured. */
type Member = {
  readonly index: number;
  readonly ref: TerritoryRef;
  /** Production files in it. */
  files: number;
  /** Edges in from other territories, and out to them. */
  ca: number;
  ce: number;
};

/** The edges from the production files of one territory into those of another. */
type Pair = {
  readonly from: Member;
  readonly to: Member;
  files: number;
  typeOnlyFiles: number;
};

const membersOf = (
  graph: ImportGraph,
  { territories, of }: Assignment,
): {
  readonly members: ReadonlyArray<Member>;
  readonly of: ReadonlyArray<Member | undefined>;
} => {
  const members = territories.map((territory, index): Member => ({
    index,
    ref: refOf(territory),
    files: 0,
    ca: 0,
    ce: 0,
  }));
  const memberOf = of.map((index) => members[index]);
  memberOf.forEach((member, node) => {
    if (member !== undefined && graph.isTest[node] !== true) {
      member.files += 1;
    }
  });
  return { members, of: memberOf };
};

/** The pairs of territories joined by an edge between production files; counts each member's `ca` and `ce` on the way. */
const pairsOf = (
  graph: ImportGraph,
  memberOf: ReadonlyArray<Member | undefined>,
): ReadonlyArray<Pair> => {
  const pairs = new Map<string, Pair>();
  for (const { from, to, isType } of graph.edges) {
    const source = memberOf[from];
    const target = memberOf[to];
    if (
      source === undefined ||
      target === undefined ||
      source === target ||
      graph.isTest[from] === true ||
      graph.isTest[to] === true
    ) {
      continue;
    }
    const key = `${source.index}:${target.index}`;
    const pair = pairs.get(key) ?? {
      from: source,
      to: target,
      files: 0,
      typeOnlyFiles: 0,
    };
    pair.files += 1;
    pair.typeOnlyFiles += isType ? 1 : 0;
    source.ce += 1;
    target.ca += 1;
    pairs.set(key, pair);
  }
  return [...pairs.values()];
};

const byRef = (left: TerritoryRef, right: TerritoryRef): number =>
  Number(left.path > right.path) - Number(left.path < right.path) ||
  Number(left.kind > right.kind) - Number(left.kind < right.kind);

const instabilityOf = ({ ca, ce }: Member): number | undefined =>
  ca + ce === 0 ? undefined : ce / (ca + ce);

const isModule = ({ ref }: Member): boolean => ref.kind !== "other";

/** The groups of territories that reach each other over `pairs`, by member positions; `other` territories are nodes like the rest. */
const groupsOf = (
  members: ReadonlyArray<Member>,
  pairs: ReadonlyArray<Pair>,
  includesTypes: boolean,
): ReadonlyArray<ReadonlyArray<number>> => {
  const successors = members.map((): Array<number> => []);
  for (const { from, to, files, typeOnlyFiles } of pairs) {
    if (includesTypes || files > typeOnlyFiles) {
      successors[from.index]?.push(to.index);
    }
  }
  return stronglyConnected(successors).filter(
    (component) => component.length > 1,
  );
};

const cycleKey = (cycle: ReadonlyArray<TerritoryRef>): string =>
  cycle.map(({ path, kind }) => `${path}\0${kind}`).join("\0");

const GAP_TOLERANCE = 1e-9;

/** Whether the pair points toward a territory at least `instabilityGap` less stable, between modules that each have `minEdges` edges. */
const pointsToLessStable = ({ from, to }: Pair): boolean => {
  const { instabilityGap, minEdges } = IMPORT_THRESHOLDS;
  const fromInstability = instabilityOf(from);
  const toInstability = instabilityOf(to);
  return (
    isModule(from) &&
    isModule(to) &&
    from.ca + from.ce >= minEdges &&
    to.ca + to.ce >= minEdges &&
    fromInstability !== undefined &&
    toInstability !== undefined &&
    toInstability - fromInstability >= instabilityGap - GAP_TOLERANCE
  );
};

const ratioOfCoupling = ({ ca, ce }: Member): number => ratioOf(ce, ca + ce);

const byFilesThenRefs = (left: Pair, right: Pair): number =>
  right.files - left.files ||
  byRef(left.from.ref, right.from.ref) ||
  byRef(left.to.ref, right.to.ref);

const territoryEntry = (
  member: Member,
): Imports["territories"]["territories"][number] =>
  Object.assign(
    {
      ...member.ref,
      files: member.files,
      ca: member.ca,
      ce: member.ce,
    },
    instabilityOf(member) === undefined
      ? {}
      : { instability: ratioOfCoupling(member) },
  );

const byCouplingThenRef = (left: Member, right: Member): number =>
  right.ca + right.ce - (left.ca + left.ce) || byRef(left.ref, right.ref);

const edgeOf = ({ from, to, files, typeOnlyFiles }: Pair) => ({
  from: from.ref,
  to: to.ref,
  files,
  typeOnlyFiles,
});

const towardLessStableEntry = (
  pair: Pair,
): Imports["territories"]["towardLessStable"][number] => ({
  from: pair.from.ref,
  to: pair.to.ref,
  files: pair.files,
  fromInstability: ratioOfCoupling(pair.from),
  toInstability: ratioOfCoupling(pair.to),
});

const mutualImportsOf = (
  members: ReadonlyArray<Member>,
  pairs: ReadonlyArray<Pair>,
): Imports["territories"]["mutualImports"] =>
  groupsOf(members, pairs, false)
    .map((group) =>
      group.flatMap((index) => members[index]?.ref ?? []).toSorted(byRef),
    )
    .toSorted((left, right) => cycleKey(left).localeCompare(cycleKey(right)))
    .map((territories) => ({ territories }));

/**
 * The map over the territories of `assignment` at `detail`, from the edges
 * between production files: each territory with its coupling, the territory
 * pairs, the pairs toward a less stable territory and the groups of
 * territories that import each other.
 */
export const territoryMapOf = (
  graph: ImportGraph,
  assignment: Assignment,
  detail: number,
): Imports["territories"] => {
  const { members, of } = membersOf(graph, assignment);
  const shown = members.filter((member) => member.files > 0);
  const pairs = pairsOf(graph, of).toSorted(byFilesThenRefs);
  const towardLessStable = pairs
    .filter((pair) => pointsToLessStable(pair))
    .map((pair) => towardLessStableEntry(pair));
  const mutualImports = mutualImportsOf(members, pairs);
  return {
    detail,
    totalTerritories: shown.length,
    territories: shown
      .toSorted(byCouplingThenRef)
      .map((member) => territoryEntry(member)),
    totalEdges: pairs.length,
    edges: pairs.map((pair) => edgeOf(pair)),
    totalTowardLessStable: towardLessStable.length,
    towardLessStable,
    totalMutualImports: mutualImports.length,
    mutualImports,
    mutualImportsWithTypes: groupsOf(members, pairs, true).length,
  };
};
