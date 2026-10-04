// Owns putting the chains of the head and of its absorbed histories into one order that a replay can follow.
// Each chain keeps its own order. Commits are interleaved by time, so a month's state holds every history as far as it had come, and a merge comes after the histories it absorbs.
import type { FirstParentChange, FirstParentCommit } from "../first-parent.js";

/** An absorbed history as read: its chain, oldest first, and where its merge put it. */
export type AbsorbedChain = {
  /** The merge that absorbed it. */
  readonly mergedAt: string;
  /** The directory, with its trailing slash, that the merge put the files under in its own tree; "" when they kept their paths. */
  readonly prefix: string;
  readonly commits: ReadonlyArray<FirstParentCommit>;
};

/** A chain being emitted. */
type Queue = {
  readonly line: number;
  readonly commits: ReadonlyArray<FirstParentCommit>;
  next: number;
  /** The time of the last commit emitted from it, which a commit without a readable date takes. */
  last: number;
};

const prefixed = (
  changes: ReadonlyArray<FirstParentChange>,
  prefix: string,
): ReadonlyArray<FirstParentChange> =>
  prefix === ""
    ? changes
    : changes.map((change) => ({ ...change, path: `${prefix}${change.path}` }));

/**
 * The chains with each absorbed line numbered from 1 in the order of `absorbed`,
 * paths named as the head's tree names them: the prefix of the merge, and
 * of the merges of the histories that absorbed this one. A merge commit lists
 * the lines it absorbs.
 */
const labelled = (
  head: ReadonlyArray<FirstParentCommit>,
  absorbed: ReadonlyArray<AbsorbedChain>,
): ReadonlyArray<ReadonlyArray<FirstParentCommit>> => {
  const lineOf = new Map<string, number>();
  const chains = [head, ...absorbed.map(({ commits }) => commits)];
  chains.forEach((chain, line) => {
    for (const { sha } of chain) {
      lineOf.set(sha, line);
    }
  });
  const prefixOf = (line: number): string => {
    const own = absorbed[line - 1];
    const host = own === undefined ? undefined : lineOf.get(own.mergedAt);
    return own === undefined || host === undefined
      ? ""
      : `${prefixOf(host)}${own.prefix}`;
  };
  const absorbedBy = new Map<string, Array<number>>();
  absorbed.forEach(({ mergedAt }, index) => {
    absorbedBy.set(mergedAt, [...(absorbedBy.get(mergedAt) ?? []), index + 1]);
  });
  return chains.map((chain, line) =>
    chain.map((commit) => {
      const absorbs = absorbedBy.get(commit.sha);
      return {
        ...commit,
        ...(line === 0 ? {} : { line }),
        ...(absorbs === undefined ? {} : { absorbs }),
        changes: prefixed(commit.changes, prefixOf(line)),
      };
    }),
  );
};

const isDone = ({ commits, next }: Queue): boolean => next >= commits.length;

const timeOf = (queue: Queue): number => {
  const time = queue.commits[queue.next]?.time ?? NaN;
  return Number.isNaN(time) ? queue.last : time;
};

/** The chains whose merge is on one of the chains: without it a history would never end. */
const mergedOnto = (
  head: ReadonlyArray<FirstParentCommit>,
  absorbed: ReadonlyArray<AbsorbedChain>,
): ReadonlyArray<AbsorbedChain> => {
  const known = new Set(
    [head, ...absorbed.map(({ commits }) => commits)].flatMap((chain) =>
      chain.map(({ sha }) => sha),
    ),
  );
  return absorbed.filter(({ mergedAt }) => known.has(mergedAt));
};

/**
 * The commits of the head's chain and of the histories absorbed along it, in
 * one order: each chain in its own, the oldest head of a chain first, and a
 * merge only after every chain it absorbs is through. Ties go to the head's
 * chain, then to the lower line. The chain of the head keeps its commits
 * unchanged apart from `absorbs`.
 */
export const combineChains = (
  head: ReadonlyArray<FirstParentCommit>,
  absorbed: ReadonlyArray<AbsorbedChain>,
): ReadonlyArray<FirstParentCommit> => {
  const queues = labelled(head, mergedOnto(head, absorbed)).map(
    (commits, line): Queue => ({ line, commits, next: 0, last: -Infinity }),
  );
  const isReady = (queue: Queue): boolean =>
    !isDone(queue) &&
    (queue.commits[queue.next]?.absorbs ?? []).every((line) => {
      const absorbedQueue = queues[line];
      return absorbedQueue === undefined || isDone(absorbedQueue);
    });
  const combined: Array<FirstParentCommit> = [];
  for (;;) {
    const queue = queues
      .filter((candidate) => isReady(candidate))
      .reduce<Queue | undefined>(
        (best, candidate) =>
          best === undefined || timeOf(candidate) < timeOf(best)
            ? candidate
            : best,
        undefined,
      );
    const commit = queue?.commits[queue.next];
    if (queue === undefined || commit === undefined) {
      return combined;
    }
    queue.last = timeOf(queue);
    queue.next += 1;
    combined.push(commit);
  }
};
