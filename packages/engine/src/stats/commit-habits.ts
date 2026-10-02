// Owns the commit habits of the repository: how many commits follow Conventional Commits and how big a commit is.
// Habits belong to the whole repository's activity window, not to a set of files.

import type { ClassifiedCommit } from "../automation/classify.js";
import type { CodeStats } from "../report/code-stats.js";
import { roundReported } from "../report/precision.js";
import { percentiles, tallyOf } from "./distribution.js";
import { ratioOf, sum } from "./measures.js";

const CONVENTIONAL_SUBJECT =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?: /u;

type Habits = Pick<CodeStats["style"], "conventionalCommits" | "commitSize">;

/**
 * The Conventional Commits share of `commits` and the size of the commits that
 * changed code, in lines added plus deleted in the paths `isCodePath` accepts,
 * so deleted files count too. Pass the non-merge commits of the window.
 */
export const commitHabits = (
  commits: ReadonlyArray<Pick<ClassifiedCommit, "subject" | "changes">>,
  isCodePath: (path: string) => boolean,
): Required<Habits> => {
  const conventional = commits.filter(({ subject }) =>
    CONVENTIONAL_SUBJECT.test(subject),
  ).length;
  const sizes = tallyOf(
    commits
      .map(({ changes }) =>
        sum(
          changes
            .filter(({ path }) => isCodePath(path))
            .map(({ added, deleted }) => added + deleted),
        ),
      )
      .filter((lines) => lines > 0),
  );
  const [median = 0, p90 = 0] = percentiles(sizes, [0.5, 0.9]);
  return {
    conventionalCommits: {
      commits: commits.length,
      conventional,
      share: ratioOf(conventional, commits.length),
    },
    commitSize: {
      commits: sum(sizes.values()),
      median: roundReported(median),
      p90: roundReported(p90),
    },
  };
};
