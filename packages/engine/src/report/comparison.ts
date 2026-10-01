// Owns the shape of the `comparison` section of the report: two spans of history and their differences.
import { Schema } from "effect";

import { AutomationTotals } from "./automation-totals.js";

const Count = Schema.Natural;
const Share = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/** The headline figures of one span of history. */
const ComparedFigures = Schema.Struct({
  /** Commits of every class. */
  commits: Count,
  /** Contributors with a commit in the span; bots and agents do not count. */
  activeContributors: Count,
  /** Lines added to code paths. */
  added: Count,
  /** Lines deleted from code paths. */
  deleted: Count,
  /** Commits per class. */
  automation: AutomationTotals,
  /** Agent-authored and agent-assisted commits as a share of all commits, rounded to 4 decimals; 0 without commits. */
  aiShare: Share,
});

/** A figure's difference between two spans. */
const Change = Schema.Struct({
  /** Window value minus previous value. */
  change: Schema.Int,
  /** `change` divided by the previous value, rounded to 4 decimals; null when the previous value is 0. */
  ratio: Schema.NullOr(Schema.Finite),
});

/**
 * The window next to the span of equal length right before it, present only
 * with `--compare`. Every figure counts like its own section: `current`
 * restates the window, so consumers need no join.
 */
export const Comparison = Schema.Struct({
  /** The span before the window, from `since` (included) to `until` (excluded, where the window starts). */
  previous: Schema.Struct({
    since: Schema.String,
    until: Schema.String,
    ...ComparedFigures.fields,
  }),
  current: ComparedFigures,
  /** Window minus previous span; a positive number means more in the window. */
  delta: Schema.Struct({
    commits: Change,
    activeContributors: Change,
    added: Change,
    deleted: Change,
    /** Difference of the two `aiShare` values as a fraction, not a ratio: 0.05 is five percentage points. */
    aiShare: Schema.Finite,
  }),
});
