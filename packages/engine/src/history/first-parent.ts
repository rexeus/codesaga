// Owns the first-parent chain of a head: for each commit on it, the files it changed against its first parent, merges included.
// This is the path state of the repository over time: a merge shows what it brought in, a conflict resolved by hand shows as the edit it is, and with renames turned into a deletion and an addition each path means what it said then. Replaying it ends in exactly the head's tree.
import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { parseRawEntry } from "./raw-entry.js";
import type { BlobFields } from "./raw-entry.js";

/** A file a commit on the chain changed, under the name it had then. */
export type FirstParentChange = BlobFields & { readonly path: string };

/** A commit on the first-parent chain. */
export type FirstParentCommit = {
  readonly sha: string;
  /** Committer time in seconds, which follows the chain better than author time after rebases; NaN when git cannot read it. */
  readonly time: number;
  readonly changes: ReadonlyArray<FirstParentChange>;
  /**
   * The history the commit belongs to: absent for the chain of the head, a
   * positive number for a history that a merge absorbed (see `readChains`).
   * Paths of different lines do not meet: each line has its own path state.
   */
  readonly line?: number;
  /**
   * The lines whose files this commit takes in as changes of its own, a merge
   * of a history that was reachable only through its second parent. Their
   * state ends here, replaced by what this commit's changes say.
   */
  readonly absorbs?: ReadonlyArray<number>;
};

const COMMIT_MARKER = "\u0001";
const LOG_ARGS = [
  "log",
  "--first-parent",
  "--diff-merges=first-parent",
  "--no-renames",
  "--raw",
  "--no-abbrev",
  "-z",
  "--format=%x01%H%x00%ct%x00",
] as const;

/**
 * The commits of `git log --first-parent -z --raw` output, oldest first.
 * Each commit is `\u0001<sha> NUL <time> NUL`, then a raw entry token and a
 * path token per changed file.
 */
const parseFirstParent = (output: string): ReadonlyArray<FirstParentCommit> => {
  const commits: Array<{
    sha: string;
    time: number;
    changes: Array<FirstParentChange>;
  }> = [];
  const tokens = output.split("\0");
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    const open = commits.at(-1);
    if (token.startsWith(COMMIT_MARKER)) {
      const time = tokens[index + 1] ?? "";
      commits.push({
        sha: token.slice(COMMIT_MARKER.length),
        time: time === "" ? NaN : Number(time),
        changes: [],
      });
      index += 1;
    } else if (open !== undefined) {
      const entry = parseRawEntry(token.replace(/^\n/u, ""));
      if (entry !== undefined) {
        open.changes.push({ path: tokens[index + 1] ?? "", ...entry.blob });
        index += 1;
      }
    }
  }
  return commits.toReversed();
};

/**
 * The first-parent chain of `head`, oldest first. In a shallow clone the
 * boundary commit has no parent and adds every file, which is the tree the
 * chain starts from. Runs git, which must be in the repository root.
 */
export const readFirstParent = (
  head: string,
): Effect.Effect<ReadonlyArray<FirstParentCommit>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    return parseFirstParent(yield* git.text([...LOG_ARGS, head]));
  });
