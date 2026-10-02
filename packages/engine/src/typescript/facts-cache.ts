// Owns the facts cache: the verdict on every parsed blob, by blob id, in a directory of the git directory.
// A blob id is a content address, so an entry stays valid until the fingerprint changes.
// The verdicts of the history are one JSON file per first byte of the blob id, because one file would pass 100 MB for a repository of Effect's size and be rewritten whole by every run that parses one new blob.
// The cache is an optimization only: reading or writing it never fails.
import { Effect, FileSystem, Path, Schema } from "effect";

import { cacheFile, writeFileAtomically } from "../cache/cache-store.js";
import { groupBy } from "../collections/group-by.js";
import type { Git } from "../git/git.js";
import { SkipReason } from "../report/typescript-deep-dive.js";
import type { FactsResult } from "./facts-of-source.js";
import { FILE_FACTS_VERSION } from "./file-facts.js";
import type { FileFacts } from "./file-facts.js";
import { INPUT_GUARD_LIMITS } from "./input-guards.js";
import { parseOptionsOf } from "./source-kinds.js";
import type { ParserStatus } from "./typescript-parser.js";

/** The directory name changes with the shape of a shard, together with its version. */
const FACTS_CACHE_DIRECTORY = "syntax-v1";

/** A shard is `<first two hex digits of the blob id>.json`. */
const SHARD_NAME = /^[0-9a-f]{2}\.json$/u;

const shardOf = (key: string): string => key.slice(0, 2);

const OPTION_EXTENSIONS = [
  "ts",
  "mts",
  "cts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
];

/**
 * What a shard holds. A shard whose `version` differs is unreadable, so
 * change the version and the directory name together when this shape changes.
 * Facts are keyed by blob id and parse options (`factsKey`), and each is
 * `FileFacts` as it is, or `{ skipped }`; the facts are not
 * checked beyond their `version`, which the fingerprint ties to the code.
 */
const CacheDocument = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.Literal(1),
    fingerprint: Schema.String,
    facts: Schema.Record(Schema.String, Schema.Unknown),
  }),
);

const isSkipped = Schema.is(Schema.Struct({ skipped: SkipReason }));

const isFileFacts = (value: unknown): value is FileFacts =>
  typeof value === "object" &&
  value !== null &&
  "version" in value &&
  value.version === FILE_FACTS_VERSION;

const resultOf = (entry: unknown): FactsResult | undefined => {
  if (isSkipped(entry)) {
    return { kind: "skipped", reason: entry.skipped };
  }
  return isFileFacts(entry) ? { kind: "parsed", facts: entry } : undefined;
};

const entryOf = (result: FactsResult): unknown =>
  result.kind === "parsed" ? result.facts : { skipped: result.reason };

/**
 * A digest of what decides the facts of a blob besides its content: the
 * parser and its version, the version of `FileFacts`, the limits of the
 * input guards, and how each extension is read. Facts cached under another fingerprint are stale.
 */
export const factsFingerprint = (
  parser: Extract<ParserStatus, { kind: "ready" }>,
): string =>
  JSON.stringify({
    parser: parser.name,
    parserVersion: parser.version,
    factsVersion: FILE_FACTS_VERSION,
    guards: INPUT_GUARD_LIMITS,
    options: OPTION_EXTENSIONS.map((extension) =>
      parseOptionsOf(`file.${extension}`),
    ),
  });

/**
 * The cache directory of the repository `Git` runs in, or undefined when git
 * cannot say where its directory is.
 */
export const factsCacheDirectory = (
  root: string,
): Effect.Effect<string | undefined, never, Git | Path.Path> =>
  cacheFile(root, FACTS_CACHE_DIRECTORY);

/** The verdicts of one shard, or none when it is unreadable, of another version or written under another `fingerprint`. */
const loadShard = (
  file: string,
  fingerprint: string,
): Effect.Effect<
  ReadonlyArray<readonly [string, FactsResult]>,
  never,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(file);
    const document = yield* Schema.decodeEffect(CacheDocument)(text);
    if (document.fingerprint !== fingerprint) {
      return [];
    }
    return Object.entries(document.facts).flatMap(([key, entry]) => {
      const result = resultOf(entry);
      return result === undefined ? [] : [[key, result] as const];
    });
  }).pipe(Effect.orElseSucceed(() => []));

/** Shards are read this many at a time. */
const SHARD_CONCURRENCY = 8;

/**
 * The verdicts in the cache `directory` by key, or none when it is missing.
 * A shard that is unreadable, of another version or written under another
 * `fingerprint` contributes nothing, and so does an entry that does not
 * read as a verdict.
 */
export const loadFactsCache = (
  directory: string,
  fingerprint: string,
): Effect.Effect<
  ReadonlyMap<string, FactsResult>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const names = yield* fs.readDirectory(directory);
    const shards = yield* Effect.forEach(
      names.filter((name) => SHARD_NAME.test(name)),
      (name) => loadShard(path.join(directory, name), fingerprint),
      { concurrency: SHARD_CONCURRENCY },
    );
    return new Map(shards.flat());
  }).pipe(
    Effect.orElseSucceed(
      () => new Map<string, FactsResult>() as ReadonlyMap<string, FactsResult>,
    ),
  );

const keysOf = (
  entries: ReadonlyArray<readonly [string, FactsResult]> | undefined,
): ReadonlySet<string> => new Set(entries?.map(([key]) => key));

/** Whether the shard holds other keys than it did. */
const differs = (
  kept: ReadonlySet<string>,
  loaded: ReadonlySet<string>,
): boolean =>
  kept.size !== loaded.size || [...kept].some((key) => !loaded.has(key));

const storeShard = (
  directory: string,
  id: string,
  fingerprint: string,
  entries: ReadonlyArray<readonly [string, FactsResult]>,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = path.join(directory, `${id}.json`);
    if (entries.length === 0) {
      yield* fs.remove(file, { force: true });
    } else {
      const text = yield* Schema.encodeEffect(CacheDocument)({
        version: 1,
        fingerprint,
        facts: Object.fromEntries(
          entries.map(([key, result]) => [key, entryOf(result)]),
        ),
      });
      yield* writeFileAtomically(file, text);
    }
  }).pipe(Effect.ignore);

/**
 * Replaces the shards of the cache `directory` whose keys changed, each
 * atomically, so that `kept` is what the cache holds next; a shard that
 * `kept` empties is removed. `loaded` is what `loadFactsCache` returned, so
 * the shards that did not change are not rewritten. A failure leaves the old
 * shard in place and is ignored.
 */
export const storeFactsCache = (
  directory: string,
  fingerprint: string,
  kept: ReadonlyMap<string, FactsResult>,
  loaded: ReadonlyMap<string, FactsResult>,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> => {
  const now = groupBy(kept, ([key]) => shardOf(key));
  const before = groupBy(loaded, ([key]) => shardOf(key));
  const changed = [...new Set([...now.keys(), ...before.keys()])].filter((id) =>
    differs(keysOf(now.get(id)), keysOf(before.get(id))),
  );
  return Effect.forEach(
    changed,
    (id) => storeShard(directory, id, fingerprint, now.get(id) ?? []),
    { concurrency: SHARD_CONCURRENCY, discard: true },
  );
};
