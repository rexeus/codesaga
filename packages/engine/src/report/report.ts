// Owns the versioned `analyze` report that agents, the CLI, and the viewer read.
// Every consumer decodes with these schemas; nothing else defines the shape.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

const Count = Schema.Natural;

/** Commits per class; the four classes partition the commits they count. */
export const AutomationTotals = Schema.Struct({
  /** Commits by a human with no agent detected. */
  human: Count,
  /** Commits by a human that carry an agent's trailer, marker or committer; each counts once. */
  agentAssisted: Count,
  /** Commits authored by an AI agent. */
  agent: Count,
  /** Commits authored by an automation account that is not an agent. */
  bot: Count,
});

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
   * counts undercount. `git fetch --unshallow` completes it.
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

/** The constants an analysis applied, reported so consumers see them. */
const Thresholds = Schema.Struct({
  /** A contributor is active with a commit in this many days before now. */
  activeDays: Count,
  /** An expert's Degree of Expertise is at least this share of the highest among the file's authors. */
  expertRatio: Schema.Finite,
  /** A directory is reported when its subtree holds at least this many universe files. */
  minDirectoryFiles: Count,
  /** A directory is a knowledge island when one person is the sole expert on at least this share of its files. */
  islandShare: Schema.Finite,
  /** A directory is orphaned when more than this share of its files have no active expert. */
  orphanedShare: Schema.Finite,
});

/** Headline numbers: the window's commits and contributors, the universe's size and languages. */
const Overview = Schema.Struct({
  /** Commits in the window. */
  commits: Count,
  /** Contributors with a commit in the 30, 90 and 365 days before now; `total` counts every contributor. */
  contributors: Schema.Struct({
    total: Count,
    active30: Count,
    active90: Count,
    active365: Count,
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
  /** A commit in the `thresholds.activeDays` days before now. */
  active: Schema.Boolean,
  /** The three directories with the most commits, at most two levels below the scope. */
  areas: Schema.Array(Schema.Struct({ path: Schema.String, commits: Count })),
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
       * listed under its account name, such as "deploy-bot[bot]".
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

/** A human the knowledge model found as an expert, with the state of their involvement. */
const Person = Schema.Struct({
  /** Most recent name used with the email. */
  name: Schema.String,
  /** Mailmap-normalized, lowercased; the identity. */
  email: Schema.String,
  /** A commit in the `thresholds.activeDays` days before now, over the full history. */
  active: Schema.Boolean,
  /** ISO timestamp of the person's last commit over the full history. */
  lastCommitAt: Schema.String,
});

/** A person's expertise over the files of one directory or inspected path set. */
export const Expert = Schema.Struct({
  ...Person.fields,
  /** Files the person is an expert on. */
  files: Count,
  /** Files on which the person is the only expert. */
  soleFiles: Count,
  /** `files` divided by the set's files, rounded to 4 decimals. */
  share: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
});

/** The knowledge state of one directory's subtree. */
const DirectoryKnowledge = Schema.Struct({
  /** Repository-relative directory. */
  path: Schema.String,
  /** Universe files in the subtree. */
  files: Count,
  /** People who must leave before more than half of the files have no expert. */
  truckFactor: Count,
  /** One person is the sole expert on at least `thresholds.islandShare` of the files. */
  island: Schema.Boolean,
  /** More than `thresholds.orphanedShare` of the files have no active expert. */
  orphaned: Schema.Boolean,
  /** The five people expert on the most files, most files first. */
  experts: Schema.Array(Expert).check(Schema.isMaxLength(5)),
  /** Plain-language explanations of the flags; empty for a directory with neither. */
  reasons: Schema.Array(Schema.String),
});

/**
 * Who knows the code and whether they are still around. Covers the whole
 * history and the universe files of the scope, independent of `window`. Only
 * humans are experts: a file changed only by bots and agents has no expert.
 * Expertise is an estimate from history, not a fact.
 */
const Knowledge = Schema.Struct({
  /** Universe files considered. */
  files: Count,
  /** Files with no human expert. */
  withoutExpert: Count,
  /** Files with no expert who is active. */
  withoutActiveExpert: Count,
  /** Removing these people, in this order, leaves more than half of the files without an expert. */
  truckFactor: Schema.Struct({
    value: Count,
    people: Schema.Array(Person),
  }),
  /**
   * Riskiest first: orphaned, then islands, then lower truck factor, then
   * more files, then path; possibly truncated (see `totals.directories`).
   */
  directories: Schema.Array(DirectoryKnowledge),
});

/**
 * The full result of `analyze`.
 *
 * The activity sections (`overview`, `activity`, `punchcard`, `contributors`,
 * `automation`) cover `window`; `knowledge` covers the whole history. A missing `agent-assisted` marker means "not
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
});
export type Report = typeof Report.Type;
