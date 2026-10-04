// Owns telling which merges of a head's first-parent chain bring in a history of their own: one whose first-parent chain ends in a root that no earlier commit of the chain reaches.
// Such a history is reachable only through a second parent, so the head's chain says nothing of how it grew; its own chain does.

/** The parents of every commit of a repository, by commit id; a root has none. */
export type ParentGraph = ReadonlyMap<string, ReadonlyArray<string>>;

/** A history that a merge absorbed. */
export type Absorption = {
  /** The newest commit of the absorbed history: the merge's second (or later) parent. */
  readonly tip: string;
  /** The merge. It lies on the first-parent chain of the head or of another absorbed history. */
  readonly mergedAt: string;
};

/**
 * The first-parent chain from `tip`, newest first, up to its root or up to
 * the commit before one in `seen`; it reaches a root when no commit of it is seen.
 */
const unseenChain = (
  graph: ParentGraph,
  seen: ReadonlySet<string>,
  tip: string,
): {
  readonly commits: ReadonlyArray<string>;
  readonly reachesRoot: boolean;
} => {
  const commits: Array<string> = [];
  let current: string | undefined = tip;
  while (current !== undefined && !seen.has(current)) {
    commits.push(current);
    const parents = graph.get(current);
    if (parents === undefined) {
      return { commits, reachesRoot: false };
    }
    if (parents.length === 0) {
      return { commits, reachesRoot: true };
    }
    current = parents[0];
  }
  return { commits, reachesRoot: false };
};

/**
 * The histories that merges on the first-parent chain of `head` absorbed,
 * oldest merge first. A second parent counts when its first-parent chain runs
 * down to a root without meeting a commit that the chain before the merge
 * already reaches: the history was never part of the head's lineage, so its
 * files exist in no state of the head's chain before the merge. A branch
 * that forks from the lineage is an ordinary merge and is left to the chain
 * of the head, as is a history that reaches the lineage through another
 * history absorbed later. Histories absorbed by a history are found too.
 */
export const absorptionsOf = (
  graph: ParentGraph,
  head: string,
): ReadonlyArray<Absorption> => {
  const seen = new Set<string>();
  const found: Array<Absorption> = [];

  const markReachable = (start: string): void => {
    const pending = [start];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      if (!seen.has(next)) {
        seen.add(next);
        pending.push(...(graph.get(next) ?? []));
      }
    }
  };

  const visit = (oldestFirst: ReadonlyArray<string>): void => {
    for (const commit of oldestFirst) {
      for (const parent of (graph.get(commit) ?? []).slice(1)) {
        join(parent, commit);
      }
      seen.add(commit);
    }
  };

  const join = (tip: string, mergedAt: string): void => {
    if (seen.has(tip)) {
      return;
    }
    const chain = unseenChain(graph, seen, tip);
    if (chain.reachesRoot) {
      found.push({ tip, mergedAt });
      visit(chain.commits.toReversed());
    } else {
      markReachable(tip);
    }
  };

  visit(unseenChain(graph, seen, head).commits.toReversed());
  return found;
};
