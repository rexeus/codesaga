// Owns reading blobs from git and parsing them into verdicts: the batches, the guards' size limit and what each verdict says about its blob.
import { Effect, Stream } from "effect";

import { groupBy } from "../collections/group-by.js";
import { readBlobs } from "../git/blob-reader.js";
import type { BlobRead, SkipReason } from "../git/blob-reader.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { DigestResult } from "./facts-of-source.js";
import { factsKey } from "./history-blobs.js";
import type { HistoryBlob } from "./history-blobs.js";
import { INPUT_GUARD_LIMITS } from "./input-guards.js";
import { ParseProgress } from "./parse-progress.js";
import type { TypeScriptParser } from "./typescript-parser.js";

/**
 * Blobs read and parsed per step. A step is spread over the parser's
 * processes in batches of its own, so it must hold several of those to keep
 * every process busy.
 */
const BATCH_BLOBS = 2_000;
/** Characters of text held per step. */
const BATCH_CHARACTERS = 32_000_000;

/** A verdict, and whether it holds for the blob's content whenever it is asked. */
export type Verdict = { readonly result: DigestResult; readonly keep: boolean };

/** What the content alone decides, under limits the fingerprint holds; a crash or an unreadable blob may not stay true. */
const isDeterministic = (result: DigestResult): boolean =>
  result.kind === "parsed" ||
  ["syntax-error", "too-deep", "too-large", "minified"].includes(result.reason);

const skippedVerdict = (
  reason: "unreadable" | "too-large",
  keep: boolean,
): Verdict => ({ result: { kind: "skipped", reason }, keep });

export const UNREADABLE = skippedVerdict("unreadable", false);

type Batch = { readonly reads: ReadonlyArray<BlobRead>; readonly size: number };

/** Groups reads into batches of at most `BATCH_BLOBS` blobs and `BATCH_CHARACTERS` characters of text. */
const inBatches = <E, R>(
  reads: Stream.Stream<BlobRead, E, R>,
): Stream.Stream<ReadonlyArray<BlobRead>, E, R> =>
  reads.pipe(
    Stream.mapAccum(
      (): Batch => ({ reads: [], size: 0 }),
      (open, read): [Batch, ReadonlyArray<ReadonlyArray<BlobRead>>] => {
        const size = open.size + ("text" in read ? read.text.length : 0);
        const grown = [...open.reads, read];
        return grown.length >= BATCH_BLOBS || size >= BATCH_CHARACTERS
          ? [{ reads: [], size: 0 }, [grown]]
          : [{ reads: grown, size }, []];
      },
      { onHalt: (open) => (open.reads.length === 0 ? [] : [open.reads]) },
    ),
  );

/** What a read that gave no text says of every blob of its id. */
const verdictOfSkip = (reason: SkipReason): Verdict => {
  if (reason === "binary") {
    return skippedVerdict("unreadable", true);
  }
  return reason === "too-large"
    ? skippedVerdict("too-large", true)
    : UNREADABLE;
};

const verdictsOf = (
  batch: ReadonlyArray<BlobRead>,
  blobsByOid: ReadonlyMap<string, ReadonlyArray<HistoryBlob>>,
  parser: TypeScriptParser["Service"],
): Effect.Effect<ReadonlyArray<readonly [string, Verdict]>> =>
  Effect.gen(function* () {
    const sources = batch.flatMap((read) =>
      "text" in read
        ? (blobsByOid.get(read.oid) ?? []).map(({ path }) => ({
            key: factsKey(read.oid, path),
            source: { path, text: read.text },
          }))
        : [],
    );
    const parsed = yield* parser.digestsOf(sources.map(({ source }) => source));
    const parsedByKey = new Map(
      sources.map(({ key }, index): [string, DigestResult | undefined] => [
        key,
        parsed[index],
      ]),
    );
    return batch.flatMap((read) =>
      (blobsByOid.get(read.oid) ?? []).map(
        ({ path }): readonly [string, Verdict] => {
          const key = factsKey(read.oid, path);
          const result = parsedByKey.get(key);
          if ("text" in read) {
            return [
              key,
              result === undefined
                ? UNREADABLE
                : { result, keep: isDeterministic(result) },
            ];
          }
          return [key, verdictOfSkip(read.skipped)];
        },
      ),
    );
  });

export const parseMissing = (
  missing: ReadonlyArray<HistoryBlob>,
  parser: TypeScriptParser["Service"],
): Effect.Effect<ReadonlyMap<string, Verdict>, GitError, Git> =>
  Effect.gen(function* () {
    const progress = yield* ParseProgress;
    const blobsByOid = groupBy(missing, ({ oid }) => oid);
    const verdicts = new Map<string, Verdict>();
    yield* readBlobs(
      [...blobsByOid.keys()].map((oid) => ({ oid })),
      {
        maxBytes: INPUT_GUARD_LIMITS.maxSourceCharacters,
      },
    ).pipe(
      inBatches,
      Stream.runForEach((batch) =>
        Effect.gen(function* () {
          for (const [key, verdict] of yield* verdictsOf(
            batch,
            blobsByOid,
            parser,
          )) {
            verdicts.set(key, verdict);
          }
          yield* progress.update(verdicts.size, missing.length);
        }),
      ),
    );
    return verdicts;
  });
