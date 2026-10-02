// Owns the facts of the history that the milestones read: when counts passed, who started when, streaks and cleanups.
// Pure over the scoped commits, so a milestone's date is the same however the history was read.
// Cost: one pass per fact over the commits, the changed paths included.

import { localDayOf } from "../activity/buckets.js";
import { dayRuns } from "../activity/day-runs.js";
import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { countCodeLines } from "../history/history.js";
import { firstPolyglotTime } from "./polyglot-history.js";
import { ACHIEVEMENT_THRESHOLDS } from "./thresholds.js";

const { unbrokenDays, springCleaningNetLines } = ACHIEVEMENT_THRESHOLDS;

/** The commit that removed the most code lines net, and the first commit that removed enough. */
type Cleanup = {
  /** The most net deleted code lines of any commit, 0 when none deleted more than it added. */
  readonly removed: number;
  /** Subject of that commit; empty when it has none. */
  readonly subject: string;
  /** Time of the oldest commit that removed at least `springCleaningNetLines`, in seconds since the epoch. */
  readonly firstPassTime: number | undefined;
};

/** What the history says, in times as seconds since the epoch and days as `localDayOf` counts them. */
export type HistoryFacts = {
  /** Every commit's time, oldest first. */
  readonly commitTimes: ReadonlyArray<number>;
  /** The time of each contributor's first commit, oldest first. */
  readonly contributorStarts: ReadonlyArray<number>;
  /** The most consecutive days with a human or agent-assisted commit in the author's local time. */
  readonly longestStreak: number;
  /** The day on which the first run of `unbrokenDays` consecutive days was complete. */
  readonly streakCompletedDay: number | undefined;
  readonly cleanup: Cleanup;
  /** See `firstPolyglotTime`. */
  readonly polyglotTime: number | undefined;
};

const contributorStartsOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyArray<number> => {
  const firstByEmail = new Map<string, number>();
  for (const commit of commits) {
    if (isContributorCommit(commit)) {
      const { email } = commit.author;
      firstByEmail.set(
        email,
        Math.min(firstByEmail.get(email) ?? Infinity, commit.time),
      );
    }
  }
  return [...firstByEmail.values()].toSorted((a, b) => a - b);
};

const cleanupOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  isCodePath: (path: string) => boolean,
): Cleanup => {
  let biggest = { removed: 0, subject: "" };
  let firstPassTime: number | undefined;
  for (const commit of commits) {
    const { added, deleted } = countCodeLines([commit], isCodePath);
    const removed = deleted - added;
    if (removed > biggest.removed) {
      biggest = { removed, subject: commit.subject };
    }
    if (
      removed >= springCleaningNetLines &&
      (firstPassTime === undefined || commit.time < firstPassTime)
    ) {
      firstPassTime = commit.time;
    }
  }
  return { ...biggest, firstPassTime };
};

/** The facts the milestones read, over the scope's commits of every class, newest first. */
export const historyFacts = (
  commits: ReadonlyArray<ClassifiedCommit>,
  isCodePath: (path: string) => boolean,
): HistoryFacts => {
  const runs = dayRuns(
    commits
      .filter((commit) => isContributorCommit(commit))
      .map(({ time, offsetMinutes }) => localDayOf(time, offsetMinutes)),
  );
  const completed = runs.find(({ length }) => length >= unbrokenDays);
  return {
    commitTimes: commits.map(({ time }) => time).toSorted((a, b) => a - b),
    contributorStarts: contributorStartsOf(commits),
    longestStreak: runs.reduce((best, { length }) => Math.max(best, length), 0),
    streakCompletedDay:
      completed === undefined ? undefined : completed.start + unbrokenDays - 1,
    cleanup: cleanupOf(commits, isCodePath),
    polyglotTime: firstPolyglotTime(commits, isCodePath),
  };
};
