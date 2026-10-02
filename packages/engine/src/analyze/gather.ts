// Owns gathering the facts of a repository: HEAD, the universe and the whole history.
// `analyze` and `inspect` share this one pass over git; each turns the facts into its own result.

import { DateTime, Effect, Path } from "effect";
import type { FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { withCustomSignatures } from "../automation/custom-signatures.js";
import type { CustomSignatures } from "../automation/custom-signatures.js";
import type { Signature } from "../automation/signatures.js";
import { NO_BLAME, readBlame } from "../blame/read-blame.js";
import type { Blame } from "../blame/read-blame.js";
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
import { packageRootsOf } from "../knowledge/package-roots.js";
import type { Report } from "../report/report.js";
import type { TypeScriptFacts } from "../typescript/gather-typescript.js";
import type { HistoryFacts } from "../typescript/history-facts.js";
import type { InventoryFile } from "../universe/inventory.js";
import { inventory, namedAsCode } from "../universe/inventory.js";
import { projectFilesOf } from "../universe/project-files.js";
import type { ProjectFiles } from "../universe/project-files.js";
import { listTrackedFiles } from "../universe/tracked-files.js";
import {
  InvalidCompare,
  resolveComparedRanges,
  resolveTimeRange,
} from "./analysis-window.js";
import type { InvalidSince, TimeRange } from "./analysis-window.js";

/** Everything `analyze` and `inspect` read; gathering it is this module's job. */
export type RepositoryFacts = {
  /** Absolute path of the work tree root, where the universe's files lie. */
  readonly root: string;
  readonly toolVersion: string;
  readonly now: DateTime.Utc;
  /** The resolved `--since` instant, or undefined for the first commit in scope. */
  readonly since: string | undefined;
  /** The span right before the window, when comparing; it ends where the window starts. */
  readonly previous: TimeRange | undefined;
  readonly repository: Omit<
    Report["repository"],
    "firstCommitAt" | "lastCommitAt"
  >;
  /** The whole history, newest first, each commit before its parents. */
  readonly commits: ReadonlyArray<HistoryCommit>;
  /** Author time in seconds of the HEAD commit itself; 0 on an unborn branch. */
  readonly headTime: number;
  readonly universe: ReadonlyArray<InventoryFile>;
  /** The `package.json` and `tsconfig*.json` files of the project, from `projectFilesOf`: the manifests and configs the deep dives read. */
  readonly projectFiles: ProjectFiles;
  /** The directories of the scope that hold a package manifest; "." is the repository root. */
  readonly packageRoots: ReadonlyArray<string>;
  /** The territory detail to start at, as requested; absent for the recommended one. */
  readonly detail: number | undefined;
  /** `git blame` of the universe files at HEAD; undefined unless `blame` was requested. */
  readonly blame: Blame | undefined;
  /** Whether a path counts as code, for files that no longer exist too. */
  readonly isCodePath: (path: string) => boolean;
  /** The table that classifies commits: the built-in rows, then the custom ones. */
  readonly signatures: ReadonlyArray<Signature>;
  /**
   * What the TypeScript parser made of the universe's TypeScript and
   * JavaScript files; absent for `inspect`, which does not parse, and for a
   * universe without such files.
   */
  readonly typescript?: TypeScriptFacts | undefined;
  /**
   * The facts of every historical TypeScript and JavaScript blob by id;
   * absent where `typescript` is, and when the parser did not load.
   */
  readonly historyFacts?: HistoryFacts | undefined;
};

/** Every expected failure of `analyze`. */
export type AnalyzeError = GitError | InvalidSince | InvalidCompare;

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
  /**
   * `<n>d`, `<n>w`, `<n>m` or `<n>y`: the window becomes the last such span
   * and the report gains a `comparison` with the equally long span before it.
   * Cannot be combined with `since`.
   */
  readonly compare?: string | undefined;
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
  /**
   * Also read `git blame` for every universe file, which reports who wrote
   * the lines that exist today. It starts one git process per file, so it is
   * slow on large repositories; absent or `false`, no blame runs.
   */
  readonly blame?: boolean | undefined;
  /**
   * The knowledge territory detail the report starts at, from 1; a detail beyond the
   * deepest one means the deepest. Absent, the detail recommended for the
   * team. Every detail is reported either way.
   */
  readonly detail?: number | undefined;
};

type Windows = Pick<RepositoryFacts, "since" | "previous">;

const resolveWindows = (
  options: AnalyzeOptions,
): Effect.Effect<Windows, InvalidSince | InvalidCompare> =>
  Effect.gen(function* () {
    if (options.compare !== undefined) {
      if (options.since !== undefined) {
        return yield* new InvalidCompare({
          input: options.compare,
          reason: "withSince",
        });
      }
      const { current, previous } = yield* resolveComparedRanges(
        options.compare,
      );
      return { since: current.since, previous };
    }
    const since =
      options.since === undefined
        ? undefined
        : (yield* resolveTimeRange(options.since)).since;
    return { since, previous: undefined };
  });

/** Blame of the universe at `head`; there is nothing to blame before the first commit. */
const blameUniverse = (
  head: string | null,
  universe: ReadonlyArray<InventoryFile>,
): Effect.Effect<Blame, GitError, Git> =>
  head === null
    ? Effect.succeed(NO_BLAME)
    : readBlame(universe.map((file) => file.path));

const gatherInRepository = (
  options: AnalyzeOptions,
  root: string,
  scope: string,
  windows: Windows,
) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const head = yield* readHead;
    const branch = yield* readBranch;
    const shallowBoundary = yield* readShallowBoundary(root);
    const tracked = yield* listTrackedFiles(scope);
    const universe = yield* inventory({
      root,
      tracked,
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
    const blame =
      options.blame === true ? yield* blameUniverse(head, universe) : undefined;
    return {
      root,
      toolVersion: options.toolVersion,
      now: yield* DateTime.now,
      ...windows,
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
      projectFiles: yield* projectFilesOf(tracked),
      packageRoots: packageRootsOf(tracked),
      detail: options.detail,
      blame,
      isCodePath: namedAsCode(options),
      signatures: withCustomSignatures(options.signatures),
    } satisfies RepositoryFacts;
  });

/**
 * Gathers the facts of the git repository containing `options.cwd`: one pass
 * over its whole history, the universe of the scope, and `Clock` time.
 *
 * Fails with `NotAGitRepository`, `GitNotFound`, or `GitCommandFailed` when
 * git cannot answer, with `InvalidSince` for a `since` that is neither
 * relative nor an ISO date in the past, and with `InvalidCompare` for a
 * `compare` that is not a relative duration or comes with `since`.
 */
export const gatherFacts = (
  options: AnalyzeOptions,
): Effect.Effect<
  RepositoryFacts,
  AnalyzeError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const windows = yield* resolveWindows(options);
    const root = yield* locateRepository(options.cwd);
    const scope =
      options.scope === undefined
        ? "."
        : yield* repositoryScope(root, options.cwd, options.scope);
    return yield* gatherInRepository(options, root, scope, windows).pipe(
      Effect.provide(Git.layer(root)),
    );
  });
