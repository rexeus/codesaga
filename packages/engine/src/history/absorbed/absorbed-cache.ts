// Owns the cache of absorbed histories: the chain of each absorbed tip and the directory each merge put it under, in the git directory.
// Both are functions of commit ids, which are content addresses, so an entry never goes stale; a run keeps only the entries it used.
// The cache is an optimization only: reading or writing it never fails.
import { Effect, FileSystem, Schema } from "effect";
import type { Path } from "effect";

import { writeFileAtomically } from "../../cache/cache-store.js";
import type { FirstParentCommit } from "../first-parent.js";

/** The file name changes with the cache document, together with its version. */
export const ABSORBED_CACHE_FILE = "absorbed-v1.json";

const CachedChain = Schema.Array(
  Schema.Struct({
    sha: Schema.String,
    /** Null for the NaN of a date git cannot read, which JSON cannot hold. */
    time: Schema.NullOr(Schema.Finite),
    changes: Schema.Array(
      Schema.Struct({
        path: Schema.String,
        oid: Schema.optionalKey(Schema.String),
        previousOid: Schema.optionalKey(Schema.String),
        mode: Schema.optionalKey(Schema.String),
        previousMode: Schema.optionalKey(Schema.String),
      }),
    ),
  }),
);

/**
 * What the cache file holds. A file whose `version` differs is unreadable, so
 * change the version and the file name together when this shape changes.
 */
const CacheDocument = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.Literal(1),
    /** The chain of each absorbed tip, oldest first, with the changes the replay reads, by tip. */
    chains: Schema.Record(Schema.String, CachedChain),
    /** The directory each merge put the history under, by `prefixKey`. */
    prefixes: Schema.Record(Schema.String, Schema.String),
  }),
);

export type AbsorbedCache = {
  readonly chains: ReadonlyMap<string, ReadonlyArray<FirstParentCommit>>;
  readonly prefixes: ReadonlyMap<string, string>;
};

/** The key of the directory a merge put the history ending in `tip` under. */
export const prefixKey = (tip: string, mergedAt: string): string =>
  `${tip} ${mergedAt}`;

const EMPTY: AbsorbedCache = { chains: new Map(), prefixes: new Map() };

/** The cache in `file`, or an empty one when it is missing, unreadable or of another version. */
export const loadAbsorbedCache = (
  file: string,
): Effect.Effect<AbsorbedCache, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(file);
    const document = yield* Schema.decodeEffect(CacheDocument)(text);
    return {
      chains: new Map(
        Object.entries(document.chains).map(([tip, chain]) => [
          tip,
          chain.map((commit) => ({
            ...commit,
            time: commit.time ?? NaN,
          })),
        ]),
      ),
      prefixes: new Map(Object.entries(document.prefixes)),
    };
  }).pipe(Effect.orElseSucceed(() => EMPTY));

const sameKeys = (
  left: ReadonlyMap<string, unknown>,
  right: ReadonlyMap<string, unknown>,
) =>
  left.size === right.size && [...left.keys()].every((key) => right.has(key));

/**
 * Replaces the cache in `file` atomically with `kept` when it holds other
 * entries than `loaded`; a failure leaves the old file in place and is ignored.
 */
export const storeAbsorbedCache = (
  file: string,
  kept: AbsorbedCache,
  loaded: AbsorbedCache,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  sameKeys(kept.chains, loaded.chains) &&
  sameKeys(kept.prefixes, loaded.prefixes)
    ? Effect.void
    : Schema.encodeEffect(CacheDocument)({
        version: 1,
        chains: Object.fromEntries(
          Array.from(kept.chains, ([tip, chain]) => [
            tip,
            chain.map(({ sha, time, changes }) => ({
              sha,
              time: Number.isNaN(time) ? null : time,
              changes,
            })),
          ]),
        ),
        prefixes: Object.fromEntries(kept.prefixes),
      }).pipe(
        Effect.flatMap((text) => writeFileAtomically(file, text)),
        Effect.ignore,
      );
