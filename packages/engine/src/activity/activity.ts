// Owns the activity section: commits and lines per week, contributors per month.
// A pure function over classified commits, so no test needs git.
// Cost is one pass over the commits plus one entry per week and month.

import type { TimeRange } from "../analyze/analysis-window.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import type { Report } from "../report/report.js";
import { monthOf, monthsOf, weekStartOf, weeksOf } from "./buckets.js";

// @scaffold links the buckets into the module graph; the body calls them once implemented.
void [monthOf, monthsOf, weekStartOf, weeksOf];

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
export const activity = (_input: ActivityInput): Report["activity"] => {
  throw new Error("@scaffold not implemented");
};
