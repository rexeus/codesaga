// Owns the repository's commits as the analysis reads them: the whole
// non-merge history, with every change under the path its file has today.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { LOG_FORMAT_ARGS, LogParser } from "./parse-log.js";
import type { Commit } from "./parse-log.js";

/** The lines one commit added to and deleted from one file. */
export type FileChange = {
  readonly path: string;
  readonly added: number;
  readonly deleted: number;
};

/** A commit whose changes are named by current paths. */
export type HistoryCommit = Omit<Commit, "changes"> & {
  readonly changes: ReadonlyArray<FileChange>;
};

export type HistoryOptions = {
  /** Commits left out entirely, such as the boundary of a shallow clone. */
  readonly skipCommits: ReadonlySet<string>;
};

/** Renames the commit's changes to current paths and records its own renames in `renamedTo`. */
const resolveRenames = (
  commit: Commit,
  renamedTo: Map<string, string>,
): HistoryCommit => ({
  ...commit,
  changes: commit.changes.map((change) => {
    const path = renamedTo.get(change.path) ?? change.path;
    if (change.renamedFrom !== undefined) {
      renamedTo.set(change.renamedFrom, path);
    }
    return { path, added: change.added, deleted: change.deleted };
  }),
});

/**
 * Reads every non-merge commit of `HEAD` from newest to oldest, author and
 * committer after `.mailmap`. A rename makes every older commit that touched
 * the old path name the new one, so a file keeps its history under its
 * current name; deleted files keep the path they had when they were deleted.
 *
 * The whole repository's log is read, never a path-limited one: a file moved
 * into the universe from outside keeps the history it had before the move.
 *
 * Git must run in the repository root, and the repository needs a `HEAD`.
 */
export const readHistory = (
  options: HistoryOptions,
): Effect.Effect<ReadonlyArray<HistoryCommit>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const renamedTo = new Map<string, string>();
    const commits: Array<HistoryCommit> = [];

    yield* git.stream(["log", ...LOG_FORMAT_ARGS]).pipe(
      Stream.mapAccum(
        () => new LogParser(),
        (parser, chunk) => [parser, parser.push(chunk)],
        { onHalt: (parser) => parser.end() },
      ),
      Stream.runForEach((commit) =>
        Effect.sync(() => {
          if (!options.skipCommits.has(commit.sha)) {
            commits.push(resolveRenames(commit, renamedTo));
          }
        }),
      ),
    );

    return commits;
  });
