// Owns the facts cache: the verdict on every parsed blob, by blob id, in the git directory.
// A blob id is a content address, so an entry stays valid until the fingerprint changes.
// The cache is an optimization only: reading or writing it never fails.
import { Effect, FileSystem, Schema } from "effect";
import type { Path } from "effect";

import { cacheFile, writeFileAtomically } from "../cache/cache-store.js";
import type { Git } from "../git/git.js";
import { SkipReason } from "../report/typescript-deep-dive.js";
import type { FactsResult } from "./facts-of-source.js";
import { FILE_FACTS_VERSION } from "./file-facts.js";
import type { FileFacts } from "./file-facts.js";
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
 * The cache file of the repository `Git` runs in, or undefined when git
 * cannot say where its directory is.
 */
export const factsCacheFile = (
  root: string,
): Effect.Effect<string | undefined, never, Git | Path.Path> =>
  cacheFile(root, FACTS_CACHE_FILE);

/**
 * The verdicts in `file` by blob id, or none when it is missing, unreadable,
 * of another version, or written under another `fingerprint`. An entry that
 * does not read as a verdict is left out.
 */
export const loadFactsCache = (
  file: string,
  fingerprint: string,
): Effect.Effect<
  ReadonlyMap<string, FactsResult>,
  never,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(file);
    const document = yield* Schema.decodeEffect(CacheDocument)(text);
    if (document.fingerprint !== fingerprint) {
      return new Map<string, FactsResult>();
    }
    const verdicts = new Map<string, FactsResult>();
    for (const [oid, entry] of Object.entries(document.facts)) {
      const result = resultOf(entry);
      if (result !== undefined) {
        verdicts.set(oid, result);
      }
    }
    return verdicts;
  }).pipe(
    Effect.orElseSucceed(
      () => new Map<string, FactsResult>() as ReadonlyMap<string, FactsResult>,
    ),
  );

/** Replaces the cache in `file` atomically with `verdicts`; a failure leaves the old file in place and is ignored. */
export const storeFactsCache = (
  file: string,
  fingerprint: string,
  verdicts: ReadonlyMap<string, FactsResult>,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Schema.encodeEffect(CacheDocument)({
    version: 1,
    fingerprint,
    facts: Object.fromEntries(
      Array.from(verdicts, ([oid, result]) => [oid, entryOf(result)]),
    ),
  }).pipe(
    Effect.flatMap((text) => writeFileAtomically(file, text)),
    Effect.ignore,
  );
