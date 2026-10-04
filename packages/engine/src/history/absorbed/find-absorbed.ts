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

/** What visiting the commits of one history found. */
type Visit = {
  readonly found: ReadonlyArray<Absorption>;
  /** Whether the history reaches a commit that is not its own, which makes it part of the lineage it merges into. */
  readonly tainted: boolean;
};

/**
 * The histories that merges on the first-parent chain of `head` absorbed,
 * oldest merge first. A second parent counts when its first-parent chain runs
 * down to a root without meeting a commit that the chain before the merge
 * already reaches, and when nothing else of the history reaches such a
 * commit either: the history was never part of the head's lineage, so its
 * files exist in no state of the head's chain before the merge, and none of
 * them is also the lineage's. A branch that forks from the lineage is an
 * ordinary merge and is left to the chain of the head, as is a history that
 * merged a commit of the lineage (an orphan branch that ran `git merge main`
 * before it was merged back), one that shares a commit with another absorbed
 * history, and one that reaches the lineage through another history absorbed
 * later. Histories absorbed by a history are found too, unless that history
 * is left to the head's chain: its merge then brings them in with the rest.
 */
export const absorptionsOf = (
  graph: ParentGraph,
  head: string,
): ReadonlyArray<Absorption> => {
  const seen = new Set<string>();

  /** Marks what is reachable from `start` as `own`, and tells whether it reached a commit that was seen and is not `own`. */
  const claim = (start: string, own: Set<string>): boolean => {
    let foreign = false;
    const pending = [start];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      if (!seen.has(next)) {
        seen.add(next);
        own.add(next);
        pending.push(...(graph.get(next) ?? []));
      } else if (!own.has(next)) {
        foreign = true;
      }
    }
    return foreign;
  };

  const visit = (
    oldestFirst: ReadonlyArray<string>,
    own: Set<string>,
  ): Visit => {
    const found: Array<Absorption> = [];
    let tainted = false;
    for (const commit of oldestFirst) {
      for (const parent of (graph.get(commit) ?? []).slice(1)) {
        const side = join(parent, commit, own);
        found.push(...side.found);
        tainted = tainted || side.tainted;
      }
      seen.add(commit);
      own.add(commit);
    }
    return { found, tainted };
  };

  const join = (tip: string, mergedAt: string, own: Set<string>): Visit => {
    if (seen.has(tip)) {
      return { found: [], tainted: !own.has(tip) };
    }
    const chain = unseenChain(graph, seen, tip);
    if (!chain.reachesRoot) {
      return { found: [], tainted: claim(tip, own) };
    }
    const inner = new Set<string>();
    const history = visit(chain.commits.toReversed(), inner);
    for (const commit of inner) {
      own.add(commit);
    }
    return {
      found: history.tainted ? [] : [{ tip, mergedAt }, ...history.found],
      tainted: false,
    };
  };

  return visit(unseenChain(graph, seen, head).commits.toReversed(), new Set())
    .found;
};
