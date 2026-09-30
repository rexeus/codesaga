// Owns the history cache file: what it holds, where it lives, and whether it still applies.
// The cache is an optimization only: reading or writing it never fails.
import { Effect, FileSystem, Path, Schema } from "effect";

import { Git } from "../git/git.js";
import type { Commit } from "./parse-log.js";

const Person = Schema.Struct({ name: Schema.String, email: Schema.String });

const CachedCommit = Schema.Struct({
  sha: Schema.String,
  /** Null for the NaN of a date git cannot read, which JSON cannot hold; likewise `committerTime`. */
  time: Schema.NullOr(Schema.Finite),
  committerTime: Schema.NullOr(Schema.Finite),
  offsetMinutes: Schema.Finite,
  author: Person,
  committer: Person,
  trailers: Schema.Array(
    Schema.Struct({ key: Schema.String, value: Schema.String }),
  ),
  markers: Schema.Array(Schema.String),
  changes: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      renamedFrom: Schema.optionalKey(Schema.String),
      removed: Schema.optionalKey(Schema.Literal(true)),
      added: Schema.Finite,
      deleted: Schema.Finite,
    }),
  ),
});

/**
 * What the cache file holds. A file whose `version` differs is unreadable, so
 * change the version and the file name together when this shape changes.
 */
const CachedHistory = Schema.Struct({
  version: Schema.Literal(1),
  /** The commit `commits` was read from. */
  head: Schema.String,
  /** Everything besides `head` that changes what git prints for the same commits. */
  fingerprint: Schema.String,
  /** The commits as `LogParser` yields them, in `inCanonicalOrder`, before any resolution. */
  commits: Schema.Array(CachedCommit),
});

const CacheDocument = Schema.fromJsonString(Schema.toCodecJson(CachedHistory));

type CachedCommit = (typeof CachedCommit)["Type"];

const toCached = (commit: Commit): CachedCommit => ({
  ...commit,
  time: Number.isNaN(commit.time) ? null : commit.time,
  committerTime: Number.isNaN(commit.committerTime)
    ? null
    : commit.committerTime,
});

const fromCached = (commit: CachedCommit): Commit => ({
  ...commit,
  time: commit.time ?? NaN,
  committerTime: commit.committerTime ?? NaN,
});

export type HistoryCache = {
  readonly head: string;
  readonly fingerprint: string;
  readonly commits: ReadonlyArray<Commit>;
};

/** How a cache relates to the history about to be read. */
export type CacheStatus =
  /** Written under other settings; nothing in it can be trusted. */
  | "stale"
  /** It covers exactly the requested head. */
  | "current"
  /** It covers another head, which may or may not be an ancestor of the requested one. */
  | "moved";

/** Decides, from the file's content alone, what the cache can still be used for. */
export const cacheStatus = (
  cache: HistoryCache,
  now: { readonly head: string; readonly fingerprint: string },
): CacheStatus => {
  if (cache.fingerprint !== now.fingerprint) {
    return "stale";
  }
  return cache.head === now.head ? "current" : "moved";
};

/**
 * The cache file of the repository `Git` runs in, inside its git directory so
 * that git never tracks it, or undefined when git cannot say where that is.
 *
 * Runs git inside `root`, so the `Git` service must be built for it.
 */
export const cacheFile = (
  root: string,
): Effect.Effect<string | undefined, never, Git | Path.Path> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const path = yield* Path.Path;
    const common = yield* git.text(["rev-parse", "--git-common-dir"]);
    return path.join(
      path.resolve(root, common.trim()),
      "codesaga",
      "history-v1.json",
    );
  }).pipe(Effect.orElseSucceed(() => undefined));

/** The cache in `file`, or undefined when it is missing, unreadable, or of another version. */
export const loadCache = (
  file: string,
): Effect.Effect<HistoryCache | undefined, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(file);
    const { head, fingerprint, commits } =
      yield* Schema.decodeEffect(CacheDocument)(text);
    return {
      head,
      fingerprint,
      commits: commits.map((commit) => fromCached(commit)),
    };
  }).pipe(Effect.orElseSucceed(() => undefined));

/**
 * Replaces the cache in `file` atomically, so a concurrent run sees the old or
 * the new file, never a torn one. A failure leaves the old file in place.
 */
export const storeCache = (
  file: string,
  cache: HistoryCache,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const text = yield* Schema.encodeEffect(CacheDocument)({
      version: 1,
      ...cache,
      commits: cache.commits.map((commit) => toCached(commit)),
    });
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(temporary, text).pipe(
      Effect.andThen(fs.rename(temporary, file)),
      Effect.tapError(() =>
        fs.remove(temporary, { force: true }).pipe(Effect.ignore),
      ),
    );
  }).pipe(Effect.ignore);
