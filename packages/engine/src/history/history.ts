// Owns the repository's commits as the analysis reads them: the whole
// non-merge history, with every change under the path its file has today and
// told apart by the life of that path it belongs to.
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
  /**
   * Set when the change belongs to an earlier life of the path: the commit
   * deleted the file, or a newer commit deleted the file that had this name
   * then. Absent for the life of the file that exists at the path today.
   */
  readonly previousLife?: true;
};

/** A commit whose changes are named by current paths. */
export type HistoryCommit = Omit<Commit, "changes"> & {
  readonly changes: ReadonlyArray<FileChange>;
};

export type HistoryOptions = {
  /** Commits left out entirely, such as the boundary of a shallow clone. */
  readonly skipCommits: ReadonlySet<string>;
};

/** What the walk from the newest commit has learned about paths. */
type Lineage = {
  /** Old path to the path its file has today. */
  readonly renamedTo: Map<string, string>;
  /**
   * Names a deleted file had in the commits older than its deletion. They are
   * names as each commit wrote them, not current paths: a file renamed onto
   * the path of a deleted one is a different file.
   */
  readonly deletedNames: Set<string>;
};

/**
 * Renames the commit's changes to current paths and marks the ones of a
 * previous life; records the commit's own renames and deletions in `lineage`.
 * A deletion ends the life of the file that had that name in the commit. A
 * file renamed onto a name that is deleted later is that dead file, so its
 * old name ends with it. A rename's old name is otherwise not a deletion, and
 * deleting and re-adding a path in one commit is an edit, as the commit's
 * diff shows it.
 */
const resolveLineage = (commit: Commit, lineage: Lineage): HistoryCommit => {
  const endedNames: Array<string> = [];
  const changes = commit.changes.map((change): FileChange => {
    const path = lineage.renamedTo.get(change.path) ?? change.path;
    const isPrevious =
      change.removed === true || lineage.deletedNames.has(change.path);
    if (change.removed === true) {
      endedNames.push(change.path);
    }
    if (change.renamedFrom !== undefined) {
      lineage.renamedTo.set(change.renamedFrom, path);
      if (isPrevious) {
        endedNames.push(change.renamedFrom);
      }
    }
    const { added, deleted } = change;
    return isPrevious
      ? { path, added, deleted, previousLife: true }
      : { path, added, deleted };
  });
  for (const name of endedNames) {
    lineage.deletedNames.add(name);
  }
  return { ...commit, changes };
};

/**
 * Reads every non-merge commit of `HEAD` from newest to oldest, author and
 * committer after `.mailmap`. A rename makes every older commit that touched
 * the old path name the new one, so a file keeps its history under its
 * current name; deleted files keep the path they had when they were deleted.
 * A deletion ends the life of the file that had the deleted name: its own
 * change and every older change to that file are marked `previousLife`, so a
 * file created or renamed onto the path later starts fresh.
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
    const lineage: Lineage = {
      renamedTo: new Map(),
      deletedNames: new Set(),
    };
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
            commits.push(resolveLineage(commit, lineage));
          }
        }),
      ),
    );

    return commits;
  });

/** The lines the commits added to and deleted from the paths that `isCodePath` accepts. */
export const countCodeLines = (
  commits: ReadonlyArray<Pick<HistoryCommit, "changes">>,
  isCodePath: (path: string) => boolean,
): { readonly added: number; readonly deleted: number } => {
  const changes = commits
    .flatMap((commit) => commit.changes)
    .filter((change) => isCodePath(change.path));
  return {
    added: changes.reduce((sum, change) => sum + change.added, 0),
    deleted: changes.reduce((sum, change) => sum + change.deleted, 0),
  };
};
