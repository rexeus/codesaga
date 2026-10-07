// Owns the facts of every historical version of every TypeScript and JavaScript file, by blob and parse options.
// Each distinct blob is parsed once per option set, ever: verdicts live in the facts cache and only new ones reach the parser.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { skipBeforeReading } from "../git/blob-reader.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { FirstParentCommit } from "../history/first-parent.js";
import type { HistoryCommit } from "../history/history.js";
import type { InventoryOptions } from "../universe/inventory.js";
import { namedAsCode } from "../universe/inventory.js";
import {
  ignoredAmong,
  withoutGeneratedFiles,
} from "../universe/tracked-files.js";
import {
  factsCacheFile,
  factsFingerprint,
  loadFactsCache,
  storeFactsCache,
} from "./facts-cache.js";
import type { DigestResult } from "./facts-of-source.js";
import { blobsOfChanges, factsKey } from "./history-blobs.js";
import type { HistoryBlob } from "./history-blobs.js";
import { readReplayedChains } from "./history-chains.js";
import { readConfigTexts } from "./history-configs.js";
import { parseMissing, UNREADABLE } from "./parse-blobs.js";
import type { Verdict } from "./parse-blobs.js";
import { TypeScriptParser } from "./typescript-parser.js";

/** The facts of the history's file versions. */
export type HistoryFacts = {
  /**
   * The verdict on each blob under the options its path is parsed with,
   * keyed by `factsKey`. Only the files the universe's path rules count are
   * here, and no symlink or submodule.
   */
  readonly factsByBlob: ReadonlyMap<string, DigestResult>;
  /**
   * The first-parent chain of the head, oldest first, with every change under
   * the name its path had then: the state of the files over time, which the
   * trends replay. Whether a change counts is for `factsByBlob` to say.
   * Histories that a merge absorbed through its second parent (see
   * `readChains`) are in it, with the changes of scripts and project configs
   * only, so the months before the head's chain begins are replayed too.
   */
  readonly firstParent: ReadonlyArray<FirstParentCommit>;
  /** The text of every version of a project `tsconfig*.json` that the chain changes, by blob id. */
  readonly configs: ReadonlyMap<string, string>;
};

export type HistoryFactsInput = Pick<
  InventoryOptions,
  "include" | "exclude"
> & {
  /** The absolute root of the work tree. */
  readonly root: string;
  /** The commit whose first-parent chain is read besides the history's changes. */
  readonly head: string;
  /** Whether the repository is a shallow clone, whose chains begin at the boundary. */
  readonly shallow: boolean;
  /** The tool's own version: a release may change what a digest holds, so digests of another version are not reused. */
  readonly toolVersion: string;
  readonly commits: ReadonlyArray<
    Pick<HistoryCommit, "changes" | "sha" | "parents">
  >;
  /** Whether verdicts are read from and written to the facts cache. */
  readonly useCache: boolean;
};

/** The verdicts worth keeping for the next run: those of `keys` that the cache had or that hold for the blob's content. */
const keptOf = (
  keys: ReadonlyArray<string>,
  cached: ReadonlyMap<string, DigestResult>,
  fresh: ReadonlyMap<string, Verdict>,
): ReadonlyMap<string, DigestResult> =>
  new Map(
    keys.flatMap((key): Array<[string, DigestResult]> => {
      const verdict = fresh.get(key);
      const result =
        cached.get(key) ??
        (verdict?.keep === true ? verdict.result : undefined);
      return result === undefined ? [] : [[key, result]];
    }),
  );

/**
 * The blobs the universe's rules would count: readable, named like code
 * (excluded directories, minified names, `include` and `exclude`) and not
 * marked `linguist-generated` or `linguist-vendored` in today's attributes,
 * and not matched by today's ignore rules (the universe leaves out a tracked
 * file that `.gitignore` matches),
 * one per blob and option set.
 */
const countedBlobs = (
  input: HistoryFactsInput,
  blobs: ReadonlyArray<HistoryBlob>,
): Effect.Effect<ReadonlyArray<HistoryBlob>, GitError, Git> =>
  Effect.gen(function* () {
    const isCode = namedAsCode(input);
    const named = blobs.filter(
      (blob) => isCode(blob.path) && skipBeforeReading(blob) === undefined,
    );
    const paths = [...new Set(named.map(({ path }) => path))];
    const attributed = new Set(yield* withoutGeneratedFiles(paths));
    const ignored = new Set(yield* ignoredAmong(paths));
    const distinct = new Map(
      named
        .filter(({ path }) => attributed.has(path) && !ignored.has(path))
        .map((blob): [string, HistoryBlob] => [
          factsKey(blob.oid, blob.path),
          blob,
        ]),
    );
    return [...distinct.values()];
  });

/**
 * Parses every blob of the history's TypeScript and JavaScript files that the
 * facts cache does not know, once per option set, and returns the verdicts of
 * all of them, or undefined when the parser did not load. Files outside the
 * universe's path rules are never read. With `useCache` the new verdicts that
 * hold for a blob's content are stored for the next run, and the cache keeps
 * only the entries this run referenced, so it follows the history instead of
 * growing with every branch; without it the cache is neither read nor
 * written. A blob git cannot give is `unreadable`.
 *
 * Fails only when git cannot answer. Progress goes to `ParseProgress`.
 * `buildReport` reads the facts from the trends layer on.
 */
export const gatherHistoryFacts = (
  input: HistoryFactsInput,
): Effect.Effect<
  HistoryFacts | undefined,
  GitError,
  | TypeScriptParser
  | Git
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
    const firstParent = yield* readReplayedChains(input);
    const wanted = yield* countedBlobs(
      input,
      blobsOfChanges([
        ...input.commits.flatMap(({ changes }) => changes),
        ...firstParent.flatMap(({ changes }) => changes),
      ]),
    );
    const file = input.useCache ? yield* factsCacheFile(input.root) : undefined;
    const fingerprint = factsFingerprint(status, input.toolVersion);
    const cached =
      file === undefined
        ? new Map<string, DigestResult>()
        : yield* loadFactsCache(file, fingerprint);
    const fresh = yield* parseMissing(
      wanted.filter(({ oid, path }) => !cached.has(factsKey(oid, path))),
      parser,
    );
    const keys = wanted.map(({ oid, path }) => factsKey(oid, path));
    const kept = keptOf(keys, cached, fresh);
    if (file !== undefined) {
      yield* storeFactsCache(file, fingerprint, kept, cached);
    }
    return {
      firstParent,
      configs: yield* readConfigTexts(firstParent),
      factsByBlob: new Map(
        keys.map((key): [string, DigestResult] => [
          key,
          kept.get(key) ?? fresh.get(key)?.result ?? UNREADABLE.result,
        ]),
      ),
    };
  });
