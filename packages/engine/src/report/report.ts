// Owns the versioned `analyze` report that agents, the CLI, and the viewer read.
// Every consumer decodes with these schemas; nothing else defines the shape.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Achievement } from "./achievements.js";
import { AutomationTotals } from "./automation-totals.js";
import { ContributorBadge } from "./badges.js";
import { CodeStats } from "./code-stats.js";
import { Comparison } from "./comparison.js";
import { Knowledge } from "./knowledge-report.js";
import { PullRequests } from "./pull-requests.js";
import { Story } from "./stories.js";
import { Thresholds } from "./thresholds.js";
import { DeepDives } from "./typescript-deep-dive.js";

const Count = Schema.Natural;

/** The repository the report describes. */
const Repository = Schema.Struct({
  /** Basename of the repository root. */
  name: Schema.String,
  /** HEAD commit, or null for a repository without commits. */
  head: Schema.NullOr(Schema.String),
  /** Checked-out branch, or null when HEAD is detached. */
  branch: Schema.NullOr(Schema.String),
  /** Repository-relative directory or file the analysis is limited to; "." for all. */
  scope: Schema.String,
  /**
   * A shallow clone: history before its oldest fetched commit is missing, so
   * counts undercount. `git fetch --unshallow` completes it. Everything that
   * needs a first commit is withheld, since the oldest commit shown is not the
   * first: no contributor has `status: "new"` (they are `active` or
   * `dormant`) or the `new-here` badge, no territory has the `new-territory` or
   * `newcomer-friendly` badge, and there are no `anniversary` or `newcomers`
   * stories.
   */
  shallow: Schema.Boolean,
  /** ISO timestamp of the oldest commit in scope over the full history; null without commits. */
  firstCommitAt: Schema.NullOr(Schema.String),
  /** ISO timestamp of the newest commit in scope over the full history; null without commits. */
  lastCommitAt: Schema.NullOr(Schema.String),
});

/** The history range the activity sections consider, resolved to ISO timestamps. */
export const ActivityWindow = Schema.Struct({
  since: Schema.String,
  until: Schema.String,
  /** Commits in the window. */
  commits: Count,
});

/** Headline numbers: the window's commits and contributors, the universe's size and languages. */
const Overview = Schema.Struct({
  /** Commits in the window. */
  commits: Count,
  /**
   * Contributors, bots and agents not included. `total` counts those with a
   * commit in the window and `active30`, `active90` and `active365` those with a
   * commit in the 30, 90 and 365 days before now. `allTime` counts everyone with
   * a commit over the full history in scope, whatever `--since` narrowed the
   * window to, so `total` of `allTime` says how much of the team the window sees.
   */
  contributors: Schema.Struct({
    total: Count,
    active30: Count,
    active90: Count,
    active365: Count,
    allTime: Count,
  }),
  /** Universe files. */
  files: Count,
  /** Non-blank lines of the universe files. */
  loc: Count,
  /** Universe languages, most lines first. */
  languages: Schema.Array(
    Schema.Struct({ name: Schema.String, files: Count, loc: Count }),
  ),
});

/** Commits and churn over time. Every week and month of the window is present, with zeros when empty. */
const Activity = Schema.Struct({
  /** Consecutive weeks, oldest first. */
  weeks: Schema.Array(
    Schema.Struct({
      /** `YYYY-MM-DD` of the week's Monday, UTC. */
      start: Schema.String,
      commits: Count,
      /** Lines added to code paths. */
      added: Count,
      /** Lines deleted from code paths. */
      deleted: Count,
    }),
  ),
  /** Consecutive calendar months, oldest first. */
  months: Schema.Array(
    Schema.Struct({
      /** `YYYY-MM`, UTC. */
      month: Schema.String,
      commits: Count,
      /** Distinct contributors with a commit in the month. */
      contributors: Count,
    }),
  ),
});

/**
 * Commits per weekday and hour in the author's local time: 7 rows (0 = Monday
 * to 6 = Sunday) of 24 columns (hour 0 to 23). Only human and agent-assisted
 * commits count: the card describes people's rhythm, which a bot's schedule
 * would distort.
 */
const Punchcard = Schema.Array(
  Schema.Array(Count).check(Schema.isBetweenLength(24, 24)),
).check(Schema.isBetweenLength(7, 7));

/** A person with at least one human or agent-assisted commit in the window. */
const Contributor = Schema.Struct({
  /** Most recent name used with the email. */
  name: Schema.String,
  /** Mailmap-normalized, lowercased; the identity. */
  email: Schema.String,
  commits: Count,
  /** Of `commits`, those that carry an agent's trailer, marker or committer. */
  agentAssistedCommits: Count,
  /** Distinct local dates with a commit. */
  activeDays: Count,
  /** Lines added to code paths. */
  added: Count,
  /** Lines deleted from code paths. */
  deleted: Count,
  /** ISO timestamps of the first and last commit in the window. */
  firstCommitAt: Schema.String,
  lastCommitAt: Schema.String,
  /** A commit in the `thresholds.activeDays` days before now; `status` judges activity over 90 days. */
  active: Schema.Boolean,
  /** The three directories with the most commits, at most two directories below the scope. */
  areas: Schema.Array(Schema.Struct({ path: Schema.String, commits: Count })),
  /**
   * Commits per week over the last 52 weeks before `window.until`, oldest
   * first, in the weeks of `activity.weeks` (Monday, UTC); the last entry is
   * the week of `window.until`. Weeks before `window.since` count zero.
   */
  weekly: Schema.Array(Count).check(Schema.isBetweenLength(52, 52)),
  /**
   * `dormant`: no commit in the 90 days before now; `new`: not dormant, the
   * first commit over the full history lies at most
   * `thresholds.badges.newHereDays` days before now and someone committed
   * before it (the founder of a young repository is `active`); otherwise
   * `active`. `new` and `active` together are the `overview.contributors.active90`
   * contributors; the `active` flag above, over 183 days, is wider.
   */
  status: Schema.Literals(["new", "active", "dormant"]),
  /** Achievements, most important first; the dashboard shows the first three. */
  badges: Schema.Array(ContributorBadge),
});

/** Commits by bots and AI agents, which never count as contributors. */
const Automation = Schema.Struct({
  totals: AutomationTotals,
  /** Consecutive calendar months of the window, oldest first, matching `activity.months`. */
  months: Schema.Array(
    Schema.Struct({ month: Schema.String, ...AutomationTotals.fields }),
  ),
  /** Detected tools, most commits first. */
  tools: Schema.Array(
    Schema.Struct({
      /**
       * The product name, with its variants merged: "Claude Code" covers the
       * CLI, the cloud and the GitHub app. A bot outside the known tools is
       * listed under its account name, such as "deploy-bot[bot]" or "effect-bot".
       */
      name: Schema.String,
      kind: Schema.Literals(["agent", "bot"]),
      /** Commits the tool authored. */
      authored: Count,
      /** Human commits that carry the tool's trailer, marker or committer; one with several agents counts for each. */
      assisted: Count,
    }),
  ),
});

/**
 * The full result of `analyze`.
 *
 * The activity sections (`overview`, `activity`, `punchcard`, `contributors`,
 * `automation`) cover `window`; `knowledge` and `stats` cover the whole history. A missing `agent-assisted` marker means "not
 * detected", not "human-written": the automation numbers are a lower bound.
 */
export const Report = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  tool: Schema.Struct({
    name: Schema.Literal("codesaga"),
    version: Schema.String,
  }),
  /** ISO timestamp of `Clock` time when the report was made. */
  generatedAt: Schema.String,
  repository: Repository,
  window: ActivityWindow,
  thresholds: Thresholds,
  /** Sizes before any output limit, so truncated reports keep their context. */
  totals: Schema.Struct({ contributors: Count, directories: Count }),
  overview: Overview,
  activity: Activity,
  punchcard: Punchcard,
  /** Sorted by commits, descending, then by name; possibly truncated (see `totals`). */
  contributors: Schema.Array(Contributor),
  automation: Automation,
  knowledge: Knowledge,
  /**
   * Code stats of all universe files at HEAD and of the history behind them,
   * independent of `window` except for the commit habits in `style`, which
   * cover the commits of the window.
   */
  stats: CodeStats,
  /**
   * Notable facts about the history and the team, most notable first, at most
   * six; empty when nothing passes a threshold.
   */
  stories: Schema.Array(Story).check(Schema.isMaxLength(6)),
  /**
   * The repository's milestones, all nine kinds in a fixed order, reached or
   * not; independent of `window`. See `Achievement` for what holds in a
   * shallow clone.
   */
  achievements: Schema.Array(Achievement).check(Schema.isBetweenLength(9, 9)),
  /** Only with `--compare`: the window against the span before it. */
  comparison: Schema.optionalKey(Comparison),
  /** Only with `--github`: pull requests and reviews read from GitHub. */
  pullRequests: Schema.optionalKey(PullRequests),
  /** Absent when the universe has no TypeScript or JavaScript file. */
  deepDives: Schema.optionalKey(DeepDives),
});
export type Report = typeof Report.Type;
