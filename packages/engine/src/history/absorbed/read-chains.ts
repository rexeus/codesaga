// Owns reading the history a replay follows: the first-parent chain of the head and, where a merge absorbed a history that only its second parent reaches, that history's own chain.
// A repository with one root reads the head's chain and nothing else.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import { cacheFile } from "../../cache/cache-store.js";
import type { GitError } from "../../git/git-errors.js";
import { Git } from "../../git/git.js";
import { readFirstParent } from "../first-parent.js";
import type { FirstParentCommit } from "../first-parent.js";
import type { HistoryCommit } from "../history.js";
import {
  ABSORBED_CACHE_FILE,
  loadAbsorbedCache,
  prefixKey,
  storeAbsorbedCache,
} from "./absorbed-cache.js";
import type { AbsorbedCache } from "./absorbed-cache.js";
import { combineChains } from "./combine.js";
import type { AbsorbedChain } from "./combine.js";
import { absorptionsOf } from "./find-absorbed.js";
import type { Absorption, ParentGraph } from "./find-absorbed.js";
import { readPrefix } from "./prefix.js";

export type ChainsInput = {
  /** The absolute root of the work tree; the `Git` service runs there. */
  readonly root: string;
  /** The commit whose first-parent chain is read. */
  readonly head: string;
  /** The history's non-merge commits, which tell whether the repository has more than one root. */
  readonly commits: ReadonlyArray<Pick<HistoryCommit, "sha" | "parents">>;
  /** A shallow clone cuts every history at its boundary, which says nothing of where a history began. */
  readonly shallow: boolean;
  /** Whether absorbed histories are read from and written to the cache. */
  readonly useCache: boolean;
  /** Whether a change to the path matters to the replay; an absorbed history keeps only those changes. */
  readonly isReplayed: (path: string) => boolean;
};

/** Histories read at once; each is one `git log`. */
const READ_CONCURRENCY = 4;

const readGraph = (head: string): Effect.Effect<ParentGraph, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const output = yield* git.text(["rev-list", "--parents", head]);
    return new Map(
      output
        .split("\n")
        .filter((line) => line !== "")
        .map((line): [string, ReadonlyArray<string>] => {
          const [sha = "", ...parents] = line.split(" ");
          return [sha, parents];
        }),
    );
  });

const readChain = (
  tip: string,
  isReplayed: (path: string) => boolean,
): Effect.Effect<ReadonlyArray<FirstParentCommit>, GitError, Git> =>
  Effect.map(readFirstParent(tip), (chain) =>
    chain.map((commit) => ({
      ...commit,
      changes: commit.changes.filter(({ path }) => isReplayed(path)),
    })),
  );

const readAbsorbed = (
  { tip, mergedAt }: Absorption,
  cache: AbsorbedCache,
  isReplayed: (path: string) => boolean,
): Effect.Effect<AbsorbedChain, GitError, Git> =>
  Effect.gen(function* () {
    return {
      mergedAt,
      prefix:
        cache.prefixes.get(prefixKey(tip, mergedAt)) ??
        (yield* readPrefix(tip, mergedAt)),
      commits: cache.chains.get(tip) ?? (yield* readChain(tip, isReplayed)),
    };
  });

/**
 * The first-parent chain of `input.head` and the chains of the histories its
 * merges absorbed (see `absorptionsOf`), in one order (see `combineChains`),
 * oldest first. An absorbed history's paths are named as the tree of the merge
 * names them, and only the changes `input.isReplayed` accepts are kept; the
 * chain of the head is whole. Absorbed chains and the directories they were
 * put under are cached in the git directory, since a commit id fixes both.
 * Runs git, which must be in the repository root.
 */
export const readChains = (
  input: ChainsInput,
): Effect.Effect<
  ReadonlyArray<FirstParentCommit>,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const hasOtherRoot =
      input.commits.filter(({ parents }) => parents.length === 0).length > 1;
    if (input.shallow || !hasOtherRoot) {
      return yield* readFirstParent(input.head);
    }
    const [head, graph] = yield* Effect.all(
      [readFirstParent(input.head), readGraph(input.head)],
      { concurrency: 2 },
    );
    const absorptions = absorptionsOf(graph, input.head);
    const file = input.useCache
      ? yield* cacheFile(input.root, ABSORBED_CACHE_FILE)
      : undefined;
    const loaded =
      file === undefined
        ? { chains: new Map(), prefixes: new Map() }
        : yield* loadAbsorbedCache(file);
    const chains = yield* Effect.forEach(
      absorptions,
      (absorption) => readAbsorbed(absorption, loaded, input.isReplayed),
      { concurrency: READ_CONCURRENCY },
    );
    if (file !== undefined) {
      yield* storeAbsorbedCache(
        file,
        {
          chains: new Map(
            absorptions.map(({ tip }, index) => [
              tip,
              chains[index]?.commits ?? [],
            ]),
          ),
          prefixes: new Map(
            absorptions.map(({ tip, mergedAt }, index) => [
              prefixKey(tip, mergedAt),
              chains[index]?.prefix ?? "",
            ]),
          ),
        },
        loaded,
      );
    }
    return combineChains(head, chains);
  });
