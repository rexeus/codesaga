// Owns the history cache file: what it holds, where it lives, and whether it still applies.
// The cache is an optimization only: reading or writing it never fails.
import { Effect, FileSystem, Path, Schema } from "effect";

import { writeFileAtomically } from "../cache/cache-store.js";
import type { Commit } from "./parse-log.js";

const Person = Schema.Struct({ name: Schema.String, email: Schema.String });

const CachedCommit = Schema.Struct({
  sha: Schema.String,
  parents: Schema.Array(Schema.String),
  /** Null for the NaN of a date git cannot read, which JSON cannot hold; likewise `committerTime`. */
  time: Schema.NullOr(Schema.Finite),
  committerTime: Schema.NullOr(Schema.Finite),
  offsetMinutes: Schema.Finite,
  author: Person,
  committer: Person,
  subject: Schema.String,
  trailers: Schema.Array(
    Schema.Struct({ key: Schema.String, value: Schema.String }),
  ),
  markers: Schema.Array(Schema.String),
  changes: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      renamedFrom: Schema.optionalKey(Schema.String),
      removed: Schema.optionalKey(Schema.Literal(true)),
      oid: Schema.optionalKey(Schema.String),
      previousOid: Schema.optionalKey(Schema.String),
      mode: Schema.optionalKey(Schema.String),
      previousMode: Schema.optionalKey(Schema.String),
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
  version: Schema.Literal(2),
  /** The commit `commits` was read from. */
  head: Schema.String,
  /** Everything besides `head` that changes what git prints for the same commits. */
  fingerprint: Schema.String,
  /** The commits as `LogParser` yields them, in `inTopologicalOrder`, merges included, before any resolution. */
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

/** The file this cache replaced when its version rose; nothing reads it again. */
const SUPERSEDED_FILE = "history-v1.json";

const removeSupersededCache = (
  file: string,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.remove(path.join(path.dirname(file), SUPERSEDED_FILE), {
      force: true,
    });
  }).pipe(Effect.ignore);

/**
 * Replaces the cache in `file` atomically, so a concurrent run sees the old or
 * the new file, never a torn one. A failure leaves the old file in place.
 * Temporary files of runs that died over an hour ago, and a `history-v1.json`
 * beside the file, are removed on the way.
 */
export const storeCache = (
  file: string,
  cache: HistoryCache,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Schema.encodeEffect(CacheDocument)({
    version: 2,
    ...cache,
    commits: cache.commits.map((commit) => toCached(commit)),
  }).pipe(
    Effect.flatMap((text) => writeFileAtomically(file, text)),
    Effect.andThen(removeSupersededCache(file)),
    Effect.ignore,
  );
