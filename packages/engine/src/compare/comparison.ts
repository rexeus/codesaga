// Owns the comparison section: the same headline figures for the window and the span before it, and their difference.
// A pure function over the two spans' classified commits, so no test needs git.

import type { TimeRange } from "../analyze/analysis-window.js";
import { aiShareOf, totalsOf } from "../automation/automation.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { countContributors } from "../contributors/count-contributors.js";
import { countCodeLines } from "../history/history.js";
import { roundReported } from "../report/precision.js";
import type { Report } from "../report/report.js";

type Comparison = NonNullable<Report["comparison"]>;
type Figures = Comparison["current"];
type Change = Comparison["delta"]["commits"];

type ComparisonInput = {
  /** The window's commits of every class. */
  readonly current: ReadonlyArray<ClassifiedCommit>;
  /** The commits of the span before the window, and that span. */
  readonly previous: {
    readonly window: TimeRange;
    /** Whether the span starts before the repository's first commit in scope. */
    readonly partial: boolean;
    readonly commits: ReadonlyArray<ClassifiedCommit>;
  };
  /** Whether a changed path counts toward added and deleted lines. */
  readonly isCodePath: (path: string) => boolean;
};

const figuresOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  isCodePath: (path: string) => boolean,
): Figures => {
  const automation = totalsOf(commits);
  return {
    commits: commits.length,
    activeContributors: countContributors(commits),
    ...countCodeLines(commits, isCodePath),
    automation,
    aiShare: roundReported(aiShareOf(automation)),
  };
};

/** The ratio is null from a previous value of zero, which has no relative change. */
const changeOf = (current: number, previous: number): Change => ({
  change: current - previous,
  ratio: previous === 0 ? null : roundReported((current - previous) / previous),
});

/**
 * The `comparison` section: figures of both spans, and per figure the
 * change from the previous span to the window. Both spans run through the
 * same functions as the report's sections, so `current` equals the report's
 * own numbers for the window.
 */
export const comparison = ({
  current,
  previous,
  isCodePath,
}: ComparisonInput): Comparison => {
  const now = figuresOf(current, isCodePath);
  const before = figuresOf(previous.commits, isCodePath);
  return {
    previous: { ...previous.window, partial: previous.partial, ...before },
    current: now,
    delta: {
      commits: changeOf(now.commits, before.commits),
      activeContributors: changeOf(
        now.activeContributors,
        before.activeContributors,
      ),
      added: changeOf(now.added, before.added),
      deleted: changeOf(now.deleted, before.deleted),
      aiShare:
        now.commits === 0 || before.commits === 0
          ? null
          : roundReported(
              aiShareOf(now.automation) - aiShareOf(before.automation),
            ),
    },
  };
};
