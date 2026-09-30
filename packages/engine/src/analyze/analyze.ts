// Owns the one entry point that turns a repository into a Report.
// It composes inventory, history, classification, and the sections; callers never see git or parsers.
// New signals join here as new Report fields, not as new entry points.

import { Effect } from "effect";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { activity } from "../activity/activity.js";
import { punchcard } from "../activity/punchcard.js";
import { automation } from "../automation/automation.js";
import { classifyCommit } from "../automation/classify.js";
import { contributors } from "../contributors/contributors.js";
import type { GitError } from "../git/git-errors.js";
import {
  locateRepository,
  readHead,
  readShallowBoundary,
  repositoryScope,
} from "../git/repository.js";
import { readHistory } from "../history/history.js";
import { overview } from "../overview/overview.js";
import { buildIdentities } from "../people/identities.js";
import { roundReported } from "../report/precision.js";
import type { Report } from "../report/report.js";
import { inventory } from "../universe/inventory.js";
import { resolveTimeRange } from "./analysis-window.js";
import type { InvalidSince } from "./analysis-window.js";

// @scaffold links the owners analyze composes into the module graph; the body calls them once implemented.
void [
  activity,
  automation,
  buildIdentities,
  classifyCommit,
  contributors,
  inventory,
  locateRepository,
  overview,
  punchcard,
  readHead,
  readHistory,
  readShallowBoundary,
  repositoryScope,
  resolveTimeRange,
  roundReported,
];

/** Every expected failure of `analyze`. */
export type AnalyzeError = GitError | InvalidSince;

export type AnalyzeOptions = {
  /** A directory inside the repository; git locates the work tree from here. */
  readonly cwd: string;
  /**
   * A directory or file, absolute or relative to `cwd`. A commit counts when
   * any of its changes lies under it. Absent, the scope is the whole repository.
   */
  readonly scope?: string | undefined;
  /**
   * `<n>d`, `<n>w`, `<n>m`, `<n>y`, or an ISO date (`YYYY-MM-DD`), resolved
   * against `Clock`. Absent, the window starts at the first commit in scope.
   */
  readonly since?: string | undefined;
  /** Globs that replace the language allow-list when non-empty. */
  readonly include: ReadonlyArray<string>;
  /** Globs removed from the universe after `include`. */
  readonly exclude: ReadonlyArray<string>;
  /** Written to `Report.tool.version`. */
  readonly toolVersion: string;
};

/**
 * Analyzes the git repository containing `options.cwd` from one pass over its
 * whole history, and reports every contributor and every week and month of
 * the window; output limits belong to the caller.
 *
 * Fails with `NotAGitRepository`, `GitNotFound`, or `GitCommandFailed` when
 * git cannot answer, and with `InvalidSince` for a `since` that is neither
 * relative nor an ISO date in the past.

 */
export const analyze = (
  _options: AnalyzeOptions,
): Effect.Effect<
  Report,
  AnalyzeError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> => Effect.die("@scaffold not implemented");
