// Owns reading the raw commits of a head: from `git log`, or from the cache
// plus the log of what is new since the cached head.
import { Effect, Stream } from "effect";
import type { FileSystem, Path } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { logFingerprint } from "./cache-fingerprint.js";
import { inTopologicalOrder } from "./commit-order.js";
import {
  cacheFile,
  cacheStatus,
  loadCache,
  storeCache,
} from "./history-cache.js";
import { LOG_FORMAT_ARGS, LogParser } from "./parse-log.js";
import type { Commit } from "./parse-log.js";

export type CommitLogOptions = {
  /** The absolute root of the work tree; the `Git` service runs there. */
  readonly root: string;
  /** The commit to read the history of; it must exist. */
  readonly head: string;
  /** The shallow boundary; it changes what git prints, so the cache is keyed on it. */
  readonly shallowBoundary: ReadonlySet<string>;
  /** Whether to read and write the cache file. */
  readonly useCache: boolean;
};

const readLog = (
  revisions: string,
): Effect.Effect<ReadonlyArray<Commit>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const commits: Array<Commit> = [];
    yield* git.stream(["log", ...LOG_FORMAT_ARGS, revisions]).pipe(
      Stream.mapAccum(
        () => new LogParser(),
        (parser, chunk) => [parser, parser.push(chunk)],
        { onHalt: (parser) => parser.end() },
      ),
      Stream.runForEach((commit) => Effect.sync(() => commits.push(commit))),
    );
    return commits;
  });

/** Whether `ancestor` is reachable from `descendant`; any failure of git counts as no. */
const isAncestor = (
  ancestor: string,
  descendant: string,
): Effect.Effect<boolean, never, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    yield* git.text(["merge-base", "--is-ancestor", ancestor, descendant]);
    return true;
  }).pipe(Effect.orElseSucceed(() => false));

const readThroughCache = (
  file: string,
  options: CommitLogOptions,
): Effect.Effect<
  ReadonlyArray<Commit>,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { head } = options;
    const fingerprint = yield* logFingerprint(
      options.root,
      options.shallowBoundary,
    );
    const cache = yield* loadCache(file);
    const status = cache && cacheStatus(cache, { head, fingerprint });
    if (cache !== undefined && status === "current") {
      return cache.commits;
    }
    const newer =
      cache !== undefined &&
      status === "moved" &&
      (yield* isAncestor(cache.head, head))
        ? [...(yield* readLog(`${cache.head}..${head}`)), ...cache.commits]
        : undefined;
    const commits = inTopologicalOrder(newer ?? (yield* readLog(head)));
    yield* storeCache(file, { head, fingerprint, commits });
    return commits;
  });

/**
 * Every commit reachable from `options.head`, merges included (without
 * changes), as `LogParser` yields them, in `inTopologicalOrder` however they
 * were assembled. With the cache on,
 * a cache written for the same head answers without running `git log`, and
 * one written for an ancestor costs only the log of the commits since; any
 * other cache is rewritten.
 * A cache that cannot be read or written is ignored silently.
 */
export const readCommits = (
  options: CommitLogOptions,
): Effect.Effect<
  ReadonlyArray<Commit>,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const file = options.useCache ? yield* cacheFile(options.root) : undefined;
    return file === undefined
      ? inTopologicalOrder(yield* readLog(options.head))
      : yield* readThroughCache(file, options);
  });
