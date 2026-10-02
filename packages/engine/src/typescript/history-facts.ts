// Owns the facts of every historical version of every TypeScript and JavaScript file, by blob id.
// Each distinct blob is parsed once, ever: verdicts live in the facts cache and only new blobs reach the parser.
import { Effect, Stream } from "effect";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { readBlobs, skipBeforeReading } from "../git/blob-reader.js";
import type { BlobRead } from "../git/blob-reader.js";
import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import type { HistoryCommit } from "../history/history.js";
import {
  factsCacheFile,
  factsFingerprint,
  loadFactsCache,
  storeFactsCache,
} from "./facts-cache.js";
import type { FactsResult } from "./facts-of-source.js";
import { blobsOfHistory, readHeadBlobs } from "./history-blobs.js";
import type { HistoryBlob } from "./history-blobs.js";
import { ParseProgress } from "./parse-progress.js";
import { TypeScriptParser } from "./typescript-parser.js";

/** The facts of the history's file versions. */
export type HistoryFacts = {
  /**
   * The verdict on each blob by its full id, for the blobs of every commit's
   * changes and of HEAD; a symlink or a submodule has none.
   */
  readonly factsByOid: ReadonlyMap<string, FactsResult>;
};

export type HistoryFactsInput = {
  /** The absolute root of the work tree. */
  readonly root: string;
  /** The commit whose files are read besides the history's changes. */
  readonly head: string;
  readonly commits: ReadonlyArray<Pick<HistoryCommit, "changes">>;
  /** Whether verdicts are read from and written to the facts cache. */
  readonly useCache: boolean;
};

/** Blobs read and parsed per step. */
const BATCH_BLOBS = 500;
/** Characters of text held per step. */
const BATCH_CHARACTERS = 32 * 1024 * 1024;

/** A verdict, and whether it holds for the blob's content whenever it is asked. */
type Verdict = { readonly result: FactsResult; readonly keep: boolean };

/** What a syntax error or a tree too deep says of the content stays true; a crash or a guard may not. */
const isDeterministic = (result: FactsResult): boolean =>
  result.kind === "parsed" ||
  result.reason === "syntax-error" ||
  result.reason === "too-deep";

const unreadable = (keep: boolean): Verdict => ({
  result: { kind: "skipped", reason: "unreadable" },
  keep,
});

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

const verdictsOf = (
  batch: ReadonlyArray<BlobRead>,
  paths: ReadonlyMap<string, string>,
  parser: TypeScriptParser["Service"],
): Effect.Effect<ReadonlyArray<readonly [string, Verdict]>> =>
  Effect.gen(function* () {
    const texts = batch.filter((read) => "text" in read);
    const parsed = yield* parser.factsOf(
      texts.map(({ oid, text }) => ({ path: paths.get(oid) ?? "", text })),
    );
    const byOid = new Map(
      texts.map(({ oid }, index): [string, FactsResult | undefined] => [
        oid,
        parsed[index],
      ]),
    );
    return batch.map((read): readonly [string, Verdict] => {
      if ("text" in read) {
        const result = byOid.get(read.oid);
        return result === undefined
          ? [read.oid, unreadable(false)]
          : [read.oid, { result, keep: isDeterministic(result) }];
      }
      return [read.oid, unreadable(read.skipped === "binary")];
    });
  });

const parseMissing = (
  missing: ReadonlyArray<HistoryBlob>,
  parser: TypeScriptParser["Service"],
): Effect.Effect<ReadonlyMap<string, Verdict>, GitError, Git> =>
  Effect.gen(function* () {
    const progress = yield* ParseProgress;
    const paths = new Map(missing.map(({ oid, path }) => [oid, path]));
    const verdicts = new Map<string, Verdict>();
    yield* readBlobs(missing).pipe(
      inBatches,
      Stream.runForEach((batch) =>
        Effect.gen(function* () {
          for (const [oid, verdict] of yield* verdictsOf(
            batch,
            paths,
            parser,
          )) {
            verdicts.set(oid, verdict);
          }
          yield* progress.update(verdicts.size, missing.length);
        }),
      ),
    );
    return verdicts;
  });

const keptOf = (
  cached: ReadonlyMap<string, FactsResult>,
  fresh: ReadonlyMap<string, Verdict>,
): ReadonlyMap<string, FactsResult> =>
  new Map([
    ...cached,
    ...Array.from(fresh)
      .filter(([, { keep }]) => keep)
      .map(([oid, { result }]): [string, FactsResult] => [oid, result]),
  ]);

/**
 * Parses every blob of the history's TypeScript and JavaScript files that the
 * facts cache does not know, and returns the verdicts of all of them, or
 * undefined when the parser did not load. With `useCache` the new verdicts
 * that hold for a blob's content (parsed facts, a syntax error, a tree too
 * deep, a blob that is not text) are stored for the next run; without it the
 * cache is neither read nor written. A blob git cannot give is `unreadable`.
 *
 * Fails only when git cannot answer. Progress goes to `ParseProgress`.
 */
export const gatherHistoryFacts = (
  input: HistoryFactsInput,
): Effect.Effect<
  HistoryFacts | undefined,
  GitError,
  | TypeScriptParser
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | Path.Path
> =>
  Effect.gen(function* () {
    const parser = yield* TypeScriptParser;
    const status = yield* parser.status;
    if (status.kind !== "ready") {
      return undefined;
    }
    const wanted = blobsOfHistory(
      input.commits,
      yield* readHeadBlobs(input.head),
    ).filter((blob) => skipBeforeReading(blob) === undefined);
    const file = input.useCache ? yield* factsCacheFile(input.root) : undefined;
    const fingerprint = factsFingerprint(status);
    const cached =
      file === undefined
        ? new Map<string, FactsResult>()
        : yield* loadFactsCache(file, fingerprint);
    const missing = wanted.filter(({ oid }) => !cached.has(oid));
    const fresh = yield* parseMissing(missing, parser);
    const kept = keptOf(cached, fresh);
    if (file !== undefined && kept.size > cached.size) {
      yield* storeFactsCache(file, fingerprint, kept);
    }
    const unreadableResult = unreadable(false).result;
    return {
      factsByOid: new Map(
        wanted.map(({ oid }): [string, FactsResult] => [
          oid,
          kept.get(oid) ?? fresh.get(oid)?.result ?? unreadableResult,
        ]),
      ),
    };
  }).pipe(Effect.provide(Git.layer(input.root)));
