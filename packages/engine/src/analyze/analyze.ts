// Owns the one entry point that turns a repository into a Report.
// It composes inventory, history, classification, and the sections; callers never see git or parsers.
// New signals join here as new Report fields, not as new entry points.

import { DateTime, Effect, Path } from "effect";
import type { FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import {
  locateRepository,
  readBranch,
  readHead,
  readShallowBoundary,
  repositoryScope,
} from "../git/repository.js";
import { readHistory } from "../history/history.js";
import type { Report } from "../report/report.js";
import { inventory, namedAsCode } from "../universe/inventory.js";
import { resolveTimeRange } from "./analysis-window.js";
import type { InvalidSince } from "./analysis-window.js";
import { buildReport } from "./build-report.js";

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

const gatherAndBuild = (
  options: AnalyzeOptions,
  root: string,
  scope: string,
  since: string | undefined,
) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const head = yield* readHead;
    const branch = yield* readBranch;
    const shallowBoundary = yield* readShallowBoundary(root);
    const universe = yield* inventory({
      root,
      scope,
      include: options.include,
      exclude: options.exclude,
    });
    const commits =
      head === null
        ? []
        : yield* readHistory({ skipCommits: shallowBoundary ?? new Set() });
    return buildReport({
      toolVersion: options.toolVersion,
      now: yield* DateTime.now,
      since,
      repository: {
        name: path.basename(root),
        head,
        branch,
        scope,
        shallow: shallowBoundary !== undefined,
      },
      commits,
      universe,
      isCodePath: namedAsCode(options),
    });
  });

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
  options: AnalyzeOptions,
): Effect.Effect<
  Report,
  AnalyzeError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const since =
      options.since === undefined
        ? undefined
        : (yield* resolveTimeRange(options.since)).since;
    const root = yield* locateRepository(options.cwd).pipe(
      Effect.provide(Git.layer(options.cwd)),
    );
    const scope =
      options.scope === undefined
        ? "."
        : yield* repositoryScope(root, options.cwd, options.scope);
    return yield* gatherAndBuild(options, root, scope, since).pipe(
      Effect.provide(Git.layer(root)),
    );
  });
