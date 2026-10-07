// Owns where a merge put an absorbed history: the directory its files moved under, as `git merge -s subtree` or a history rewritten to live in a folder does.
// Paths of the absorbed history's own commits are named by that directory afterwards, which is what the universe's rules and the report speak of.
import { Effect } from "effect";

import type { GitError } from "../../git/git-errors.js";
import { Git } from "../../git/git.js";
import { parseRawEntry } from "../raw-entry.js";

/** A file the merge's tree has under another path than the absorbed history's tree does. */
type Move = { readonly from: string; readonly to: string };

/** The moves in `git diff-tree --raw -z` output: the entries git paired as renames. */
const movesOf = (output: string): ReadonlyArray<Move> => {
  const moves: Array<Move> = [];
  const tokens = output.split("\0");
  for (let index = 0; index < tokens.length; index += 1) {
    const entry = parseRawEntry((tokens[index] ?? "").replace(/^\n/u, ""));
    if (entry?.status === "R") {
      moves.push({
        from: tokens[index + 1] ?? "",
        to: tokens[index + 2] ?? "",
      });
      index += 2;
    } else if (entry !== undefined) {
      index += 1;
    }
  }
  return moves;
};

/** The directory (with its trailing slash) that `move` put its file under, or undefined when the file moved to another name or out. */
const prefixOfMove = ({ from, to }: Move): string | undefined => {
  if (!to.endsWith(from)) {
    return undefined;
  }
  const prefix = to.slice(0, to.length - from.length);
  return prefix.endsWith("/") ? prefix : undefined;
};

/** The directory most moves agree on; none when no file moved under one. */
const commonPrefix = (moves: ReadonlyArray<Move>): string => {
  const votes = new Map<string, number>();
  for (const move of moves) {
    const prefix = prefixOfMove(move);
    if (prefix !== undefined) {
      votes.set(prefix, (votes.get(prefix) ?? 0) + 1);
    }
  }
  const [winner] = [...votes].toSorted(
    ([left, leftVotes], [right, rightVotes]) =>
      rightVotes - leftVotes || left.length - right.length,
  );
  return winner?.[0] ?? "";
};

/**
 * The directory under which the merge `mergedAt` placed the files of the
 * history ending in `tip`, with its trailing slash, or "" when they kept
 * their paths. It is read from the files of `tip` that the merge's tree has
 * unchanged under a longer path (the same blob, so an exact rename), where
 * the longer path is the old one under a directory; the directory most of
 * them agree on wins. A merge that edited every moved file at once leaves
 * nothing to read, and the answer is "". Runs git in the repository root.
 */
export const readPrefix = (
  tip: string,
  mergedAt: string,
): Effect.Effect<string, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const output = yield* git.text([
      "diff-tree",
      "-r",
      "--raw",
      "--no-abbrev",
      "-z",
      "--find-renames=100%",
      tip,
      mergedAt,
    ]);
    return commonPrefix(movesOf(output));
  });
