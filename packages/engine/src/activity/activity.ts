// Owns the activity section: commits and lines per week, contributors per month.
// A pure function over classified commits, so no test needs git.
// Cost is one pass over the commits plus one entry per week and month.

import type { TimeRange } from "../analyze/analysis-window.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { groupBy } from "../collections/group-by.js";
import { countContributors } from "../contributors/count-contributors.js";
import { countCodeLines } from "../history/history.js";
import type { Report } from "../report/report.js";
import { monthOf, monthsOf, weekStartOf, weeksOf } from "./buckets.js";

type ActivityInput = {
  /** The window's commits of every class. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly window: TimeRange;
  /** Whether a changed path counts toward added and deleted lines. */
  readonly isCodePath: (path: string) => boolean;
};

/**
 * The `activity` section: every week and month of the window, empty ones
 * with zeros. Weeks count every commit and the lines of code paths; a
 * month's `contributors` counts the distinct identities with a human or
 * agent-assisted commit.
 */
export const activity = ({
  commits,
  window,
  isCodePath,
}: ActivityInput): Report["activity"] => {
  const byWeek = groupBy(commits, (commit) => weekStartOf(commit.time));
  const byMonth = groupBy(commits, (commit) => monthOf(commit.time));
  return {
    weeks: weeksOf(window).map((start) => {
      const inWeek = byWeek.get(start) ?? [];
      const { added, deleted } = countCodeLines(inWeek, isCodePath);
      return { start, commits: inWeek.length, added, deleted };
    }),
    months: monthsOf(window).map((month) => {
      const inMonth = byMonth.get(month) ?? [];
      return {
        month,
        commits: inMonth.length,
        contributors: countContributors(inMonth),
      };
    }),
  };
};
