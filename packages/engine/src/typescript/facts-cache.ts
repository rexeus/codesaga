// Owns the facts cache: the digest of every parsed blob, by blob id and parse options, in the git directory.
// A blob id is a content address, so an entry stays valid until the fingerprint changes.
// A digest is a row of about 200 bytes, so the whole history of a repository of Effect's size is one file of a few megabytes.
// The cache is an optimization only: reading or writing it never fails.
import { Effect, FileSystem, Schema } from "effect";
import type { Path } from "effect";

import { cacheFile, writeFileAtomically } from "../cache/cache-store.js";
import type { Git } from "../git/git.js";
import { SkipReason } from "../report/typescript-deep-dive.js";
import {
  digestOfRow,
  digestRow,
  FILE_DIGEST_VERSION,
} from "./digest/file-digest.js";
import type { DigestResult } from "./facts-of-source.js";
import { INPUT_GUARD_LIMITS } from "./input-guards.js";
import { parseOptionsOf } from "./source-kinds.js";
import type { ParserStatus } from "./typescript-parser.js";

/** The file name changes with the cache document, together with its version. */
const FACTS_CACHE_FILE = "syntax-v1.json";

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
 * What the cache file holds. A file whose `version` differs is unreadable, so
 * change the version and the file name together when this shape changes.
 * Digests are keyed by blob id and parse options (`factsKey`), and each is a
 * `digestRow` or `{ skipped }`.
 */
const CacheDocument = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.Literal(1),
    fingerprint: Schema.String,
    facts: Schema.Record(Schema.String, Schema.Unknown),
  }),
);

const isSkipped = Schema.is(Schema.Struct({ skipped: SkipReason }));

const resultOf = (entry: unknown): DigestResult | undefined => {
  if (isSkipped(entry)) {
    return { kind: "skipped", reason: entry.skipped };
  }
  const digest = digestOfRow(entry);
  return digest === undefined ? undefined : { kind: "parsed", facts: digest };
};

const entryOf = (result: DigestResult): unknown =>
  result.kind === "parsed"
    ? digestRow(result.facts)
    : { skipped: result.reason };

/**
 * A digest of what decides the digest of a blob besides its content: the
 * parser and its version, the version of `FileDigest`, the limits of the
 * input guards, and how each extension is read. Digests cached under another
 * fingerprint are stale.
 */
export const factsFingerprint = (
  parser: Extract<ParserStatus, { kind: "ready" }>,
): string =>
  JSON.stringify({
    parser: parser.name,
    parserVersion: parser.version,
    digestVersion: FILE_DIGEST_VERSION,
    guards: INPUT_GUARD_LIMITS,
    options: OPTION_EXTENSIONS.map((extension) =>
      parseOptionsOf(`file.${extension}`),
    ),
  });

/**
 * The cache file of the repository `Git` runs in, or undefined when git
 * cannot say where its directory is.
 */
export const factsCacheFile = (
  root: string,
): Effect.Effect<string | undefined, never, Git | Path.Path> =>
  cacheFile(root, FACTS_CACHE_FILE);

/**
 * The digests in `file` by key, or none when it is missing, unreadable, of
 * another version, or written under another `fingerprint`. An entry that
 * does not read as a verdict is left out.
 */
export const loadFactsCache = (
  file: string,
  fingerprint: string,
): Effect.Effect<
  ReadonlyMap<string, DigestResult>,
  never,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(file);
    const document = yield* Schema.decodeEffect(CacheDocument)(text);
    if (document.fingerprint !== fingerprint) {
      return new Map<string, DigestResult>();
    }
    return new Map(
      Object.entries(document.facts).flatMap(([key, entry]) => {
        const result = resultOf(entry);
        return result === undefined ? [] : [[key, result] as const];
      }),
    );
  }).pipe(
    Effect.orElseSucceed(
      () =>
        new Map<string, DigestResult>() as ReadonlyMap<string, DigestResult>,
    ),
  );

/**
 * Replaces the cache in `file` atomically with `kept` when it holds other
 * keys than `loaded`, the digests `loadFactsCache` returned; a failure leaves
 * the old file in place and is ignored.
 */
export const storeFactsCache = (
  file: string,
  fingerprint: string,
  kept: ReadonlyMap<string, DigestResult>,
  loaded: ReadonlyMap<string, DigestResult>,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  kept.size === loaded.size && [...kept.keys()].every((key) => loaded.has(key))
    ? Effect.void
    : Schema.encodeEffect(CacheDocument)({
        version: 1,
        fingerprint,
        facts: Object.fromEntries(
          Array.from(kept, ([key, result]) => [key, entryOf(result)]),
        ),
      }).pipe(
        Effect.flatMap((text) => writeFileAtomically(file, text)),
        Effect.ignore,
      );
