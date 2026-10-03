// Owns replaying the first-parent chain: which version of each file exists after each commit, and what the existing files add up to.
// A trend point is exact for the files the digests cover and costs one add and one subtract per change; nothing is re-summed per month.
import type { FirstParentCommit } from "../../history/first-parent.js";
import { memoizedByPath } from "../../universe/memoized-path.js";
import { isTestPath } from "../../universe/path-kinds.js";
import type { FactsLookup } from "./facts-lookup.js";
import { countsOf, MEASURES } from "./file-counts.js";

/** A commit of the chain as the replay reads it. */
type ReplayedCommit = Pick<FirstParentCommit, "time" | "changes">;

/** Counts per group: production files first, then test files; each aligned with `MEASURES`. */
export type Totals = readonly [ReadonlyArray<number>, ReadonlyArray<number>];

const ZEROS: ReadonlyArray<number> = MEASURES.map(() => 0);

const isTest = memoizedByPath(isTestPath);

const groupOf = (path: string): 0 | 1 => (isTest(path) ? 1 : 0);

/** The month of a time in seconds as a count of months since year 0, in UTC. */
export const monthOf = (seconds: number): number => {
  const date = new Date(seconds * 1000);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
};

/** The running totals and the version each path holds. */
class Tally {
  readonly #held = new Map<string, ReadonlyArray<number> | undefined>();
  readonly #totals: [Array<number>, Array<number>] = [[...ZEROS], [...ZEROS]];

  /** Makes `counts` the file at `path`; undefined removes the file. */
  set(path: string, counts: ReadonlyArray<number> | undefined): void {
    const total = this.#totals[groupOf(path)];
    this.#held.get(path)?.forEach((count, index) => {
      total[index] = (total[index] ?? 0) - count;
    });
    counts?.forEach((count, index) => {
      total[index] = (total[index] ?? 0) + count;
    });
    this.#held.set(path, counts);
  }

  snapshot(): Totals {
    return [[...this.#totals[0]], [...this.#totals[1]]];
  }
}

const countsAt = (
  lookup: FactsLookup,
  path: string,
  oid: string | undefined,
): ReadonlyArray<number> | undefined => {
  const digest = oid === undefined ? undefined : lookup(oid, path);
  return digest === undefined ? undefined : countsOf(digest, path);
};

/**
 * For each month from `firstMonth` to `lastMonth`, the index of the last
 * commit of the chain that is dated in that month or before it, or -1 when
 * none is. A commit dated before the commits ahead of it (clock skew, a
 * rebase) is dated where it says, so the state from its month on includes
 * everything the chain had done up to it; a commit with an unreadable date,
 * one before the epoch or one after `lastMonth` is in no month, though its
 * changes are in every state after it.
 */
const lastCommitPerMonth = (
  commits: ReadonlyArray<ReplayedCommit>,
  firstMonth: number,
  lastMonth: number,
): ReadonlyArray<number> => {
  const newestIn = new Map<number, number>();
  commits.forEach(({ time }, index) => {
    const month = monthOf(time);
    if (time >= 0 && month >= firstMonth && month <= lastMonth) {
      newestIn.set(month, index);
    }
  });
  let last = -1;
  return Array.from({ length: lastMonth - firstMonth + 1 }, (_, offset) => {
    last = Math.max(last, newestIn.get(firstMonth + offset) ?? -1);
    return last;
  });
};

/**
 * The totals of the files at the end of every month from `firstMonth` to
 * `lastMonth`, replaying `commits`, the first-parent chain oldest first. The
 * point of a month is the state after its last commit as `lastCommitPerMonth`
 * finds it; the point of `lastMonth` is the state after the whole chain,
 * which is the head's committed tree, uncommitted edits not included. A
 * month without a commit repeats the one before. The keys are paths at the
 * time, so a file renamed to a name that is not a script leaves the totals.
 */
export const monthlyTotals = ({
  commits,
  lookup,
  firstMonth,
  lastMonth,
}: {
  readonly commits: ReadonlyArray<ReplayedCommit>;
  readonly lookup: FactsLookup;
  readonly firstMonth: number;
  readonly lastMonth: number;
}): ReadonlyArray<Totals> => {
  const lastIndexes = lastCommitPerMonth(commits, firstMonth, lastMonth);
  const monthsEndingAt = new Map<number, Array<number>>();
  lastIndexes.forEach((index, offset) => {
    monthsEndingAt.set(index, [...(monthsEndingAt.get(index) ?? []), offset]);
  });
  const tally = new Tally();
  const empty: Totals = [[...ZEROS], [...ZEROS]];
  const points: Array<Totals> = lastIndexes.map(() => empty);
  commits.forEach(({ changes }, index) => {
    for (const { path, oid } of changes) {
      tally.set(path, countsAt(lookup, path, oid));
    }
    const offsets = monthsEndingAt.get(index);
    if (offsets !== undefined) {
      const snapshot = tally.snapshot();
      for (const offset of offsets) {
        points[offset] = snapshot;
      }
    }
  });
  points[points.length - 1] = tally.snapshot();
  return points;
};
