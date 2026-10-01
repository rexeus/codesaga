// Owns gathering the facts of a repository: HEAD, the universe and the whole history.
// `analyze` and `inspect` share this one pass over git; each turns the facts into its own result.

import { DateTime, Effect, Path } from "effect";
import type { FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { withCustomSignatures } from "../automation/custom-signatures.js";
import type { CustomSignatures } from "../automation/custom-signatures.js";
import type { Signature } from "../automation/signatures.js";
import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import {
  locateRepository,
  readBranch,
  readHead,
  readShallowBoundary,
  repositoryScope,
} from "../git/repository.js";
import type { HistoryCommit } from "../history/history.js";
import { readHistory } from "../history/history.js";
import type { Report } from "../report/report.js";
import type { InventoryFile } from "../universe/inventory.js";
import { inventory, namedAsCode } from "../universe/inventory.js";
import { resolveTimeRange } from "./analysis-window.js";
import type { InvalidSince } from "./analysis-window.js";

/** Everything `analyze` and `inspect` read; gathering it is this module's job. */
export type RepositoryFacts = {
  readonly toolVersion: string;
  readonly now: DateTime.Utc;
  /** The resolved `--since` instant, or undefined for the first commit in scope. */
  readonly since: string | undefined;
  readonly repository: Omit<
    Report["repository"],
    "firstCommitAt" | "lastCommitAt"
  >;
  /** The whole history, newest first, each commit before its parents. */
  readonly commits: ReadonlyArray<HistoryCommit>;
  /** Author time in seconds of the HEAD commit itself; 0 on an unborn branch. */
  readonly headTime: number;
  readonly universe: ReadonlyArray<InventoryFile>;
  /** Whether a path counts as code, for files that no longer exist too. */
  readonly isCodePath: (path: string) => boolean;
  /** The table that classifies commits: the built-in rows, then the custom ones. */
  readonly signatures: ReadonlyArray<Signature>;
};

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
  /**
   * In-house bots and agents to recognize besides the built-in ones. They are
   * matched after the built-in table, on the commits read from git or from
   * the history cache, which holds no classification.
   */
  readonly signatures?: CustomSignatures | undefined;
  /** Written to `Report.tool.version`. */
  readonly toolVersion: string;
  /**
   * Reuse the parsed history cached in the repository's git directory and
   * update it; `false` reads git every time and leaves the cache alone.
   * Absent, the cache is used. Results are identical either way.
   */
  readonly cache?: boolean | undefined;
};

const gatherInRepository = (
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
    const { commits, headTime } =
      head === null
        ? { commits: [], headTime: 0 }
        : yield* readHistory({
            root,
            head,
            shallowBoundary: shallowBoundary ?? new Set(),
            useCache: options.cache ?? true,
          });
    return {
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
      headTime,
      universe,
      isCodePath: namedAsCode(options),
      signatures: withCustomSignatures(options.signatures),
    } satisfies RepositoryFacts;
  });

/**
 * Gathers the facts of the git repository containing `options.cwd`: one pass
 * over its whole history, the universe of the scope, and `Clock` time.
 *
 * Fails with `NotAGitRepository`, `GitNotFound`, or `GitCommandFailed` when
 * git cannot answer, and with `InvalidSince` for a `since` that is neither
 * relative nor an ISO date in the past.
 */
export const gatherFacts = (
  options: AnalyzeOptions,
): Effect.Effect<
  RepositoryFacts,
  AnalyzeError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const since =
      options.since === undefined
        ? undefined
        : (yield* resolveTimeRange(options.since)).since;
    const root = yield* locateRepository(options.cwd);
    const scope =
      options.scope === undefined
        ? "."
        : yield* repositoryScope(root, options.cwd, options.scope);
    return yield* gatherInRepository(options, root, scope, since).pipe(
      Effect.provide(Git.layer(root)),
    );
  });
